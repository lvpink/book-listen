/**
 * bookUtils.js - 微信读书项目核心逻辑工具类
 * 整合了：查重统计上传、自动重命名、管理员封面权限、批量删除、状态钩子同步
 */
import SparkMD5 from './spark-md5.js';
const BASE_URL = 'https://gpge0t0fd7.sealosbja.site';
/**
 * 内部私有：文件名清洗
 */
const sanitizeFileName = (fileName) => {
  if (!fileName) return `file_${Date.now()}`;
  const lastDotIndex = fileName.lastIndexOf('.');
  let name = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
  const ext = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';

  let cleanName = name
    .replace(/[\\/:*?"<>|#\[\]@!$&'()+,;=\s]/g, '_')
    .replace(/_{2,}/g, '_');

  if (cleanName.length > 80) cleanName = cleanName.substring(0, 80);
  return cleanName + ext;
};

/**
 * 1. 批量上传图书 (带查重统计报告)
 */
/**
 * 1. 批量上传图书 (适配 Laf 云函数: handle-book-upload)
 */
export const universalUploadBook = (options) => {
  const {
    userId,
    isPublic = false,
    count = 5,
    onStart,
    onSuccess,
    onComplete,
    onReportConfirm
  } = options;

  wx.chooseMessageFile({
    count: count,
    type: 'file',
    extension: ['txt'], // 目前云函数主要处理 TXT
    success: async (res) => {
      const files = res.tempFiles;
      if (onStart) onStart();

      const stats = {
        success: [],
        failed: []
      };
      const fs = wx.getFileSystemManager();

      for (let i = 0; i < files.length; i++) {
        const originalName = files[i].name;
        wx.showLoading({
          title: `处理中(${i + 1}/${files.length})`,
          mask: true
        });

        try {
          // A. 读取文件内容为字符串
          const content = fs.readFileSync(files[i].path, 'utf8');

          // B. 计算 MD5
          const spark = new SparkMD5();
          spark.append(content);
          const file_md5 = spark.end();

          // C. 调用 Laf 云函数 (通过 wx.request 发送 JSON)
          const uploadRes = await new Promise((resolve, reject) => {
            wx.request({
              url: `${BASE_URL}/handle-book-upload`,
              method: 'POST',
              data: {
                openid: userId, // 必须传这个，云函数才能识别你是谁
                type: isPublic ? 'public' : 'private',
                fileName: originalName,
                file_md5: file_md5,
                content: content,
                coverUrl: "" // 封面可后续更新，或在此处预传
              },
              header: {
                'Authorization': `Bearer ${wx.getStorageSync('token')}`
              }, // 如果有登录态
              success: (r) => resolve(r.data),
              fail: reject
            });
          });

          if (uploadRes.code === 200) {
            stats.success.push(originalName);
          } else {
            stats.failed.push({
              name: originalName,
              reason: uploadRes.msg || '上传失败'
            });
          }
        } catch (err) {
          stats.failed.push({
            name: originalName,
            reason: '处理异常'
          });
        }
      }

      wx.hideLoading();
      showUploadReport(stats, onReportConfirm);
      if (onSuccess) onSuccess(stats.success.length);
      if (onComplete) onComplete();
    }
  });
};

/**
 * 内部私有：展示上传统计对话框
 */
const showUploadReport = (stats, onReportConfirm) => {
  const sCount = stats.success.length;
  const fCount = stats.failed.length;

  let report = `✅ 成功：${sCount} 本\n`;
  if (fCount > 0) {
    report += `❌ 失败：${fCount} 本\n\n失败详情：\n`;
    stats.failed.forEach((item, index) => {
      report += `${index + 1}. ${item.name}: ${item.reason}\n`;
    });
  } else {
    report += `🎉 全部处理成功！`;
  }

  wx.showModal({
    title: '上传结果统计',
    content: report,
    showCancel: false,
    confirmText: '确认',
    success: (res) => {
      if (res.confirm) {
        // 只有当传入了且它是函数时才执行
        if (onReportConfirm && typeof onReportConfirm === 'function') {
          onReportConfirm();
        }
        // 如果没传，程序会静默结束，不会报错，这正是我们想要的
      }
    }
  });
};

export const universalUploadCover = (options) => {
  const {
    bookId,
    userId, // 必须接收这个，对应 index.js 传来的 getApp().globalData.userId
    isAdmin,
    onStart,
    onSuccess,
    onComplete
  } = options;

  // 如果需要限制只有管理员能改，保留此判断；
  // 但如果是私人书架，建议去掉此判断，让用户能改自己的封面。
  /* if (!isAdmin) { ... } */

  wx.chooseImage({
    count: 1,
    sizeType: ['compressed'], // 强烈建议压缩，Base64 体积很大
    success: (res) => {
      const tempFilePath = res.tempFilePaths[0];
      const fs = wx.getFileSystemManager();

      // 读取图片为 Base64
      const base64Content = fs.readFileSync(tempFilePath, 'base64');
      const fileName = tempFilePath.substring(tempFilePath.lastIndexOf('/') + 1);

      if (onStart) onStart(bookId);
      wx.showLoading({ title: '同步封面...', mask: true });

      wx.request({
        url: `${BASE_URL}/handle-cover-upload`,
        method: 'POST',
        data: {
          openid: userId,   // 【关键修改】：显式传递 openid
          bookId: bookId,
          fileName: fileName,
          content: base64Content
        },
        // 移除 header，避免不必要的鉴权干扰
        success: (uploadRes) => {
          const resData = uploadRes.data;
          if (resData.code === 200) {
            wx.showToast({ title: '封面已同步' });
            if (onSuccess) onSuccess(resData.url);
          } else {
            wx.showModal({
              title: '更新失败',
              content: resData.msg || '服务器错误',
              showCancel: false
            });
          }
        },
        fail: () => wx.showToast({ title: '接口调用失败', icon: 'none' }),
        complete: () => {
          wx.hideLoading();
          if (onComplete) onComplete();
        }
      });
    }
  });
};

/**
 * 3. 批量删除 (增加 Token 校验)
 */
export const universalBatchDelete = (options) => {
  const { ids, userId, onSuccess } = options; // 这里解构 userId
  if (!ids || ids.length === 0) return;

  wx.showModal({
    title: '确认删除',
    content: `确定要删除这 ${ids.length} 本书及其云端分片吗？`,
    success: (res) => {
      if (res.confirm) {
        wx.showLoading({ title: '正在清理...' });

        Promise.all(ids.map(id => {
          return new Promise(resolve => {
            wx.request({
              url: `${BASE_URL}/handle-book-delete`,
              method: 'POST',
              data: {
                bookId: id,
                openid: userId // 【关键】：把 userId 赋值给后端的 openid
              },
              // 注意：这里去掉了之前的 Authorization Header，改用 data 传参
              success: (res) => {
                if (res.data.code === 200) resolve(true);
                else resolve(false);
              },
              fail: () => resolve(false)
            });
          });
        })).then(() => {
          wx.hideLoading();
          wx.showToast({ title: '清理完成' });
          if (onSuccess) onSuccess();
        });
      }
    }
  });
};;