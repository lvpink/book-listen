/**
 * bookUtils.js - 微信读书项目核心逻辑工具类
 * 整合了：查重统计上传、自动重命名、管理员封面权限、批量删除、状态钩子同步
 */

const BASE_URL = 'https://rf3pmm2lnj.sealosbja.site';

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
export const universalUploadBook = (options) => {
  const { userId, isPublic = false, count = 9, onStart, onSuccess, onComplete } = options;

  wx.chooseMessageFile({
    count: count,
    type: 'file',
    extension: ['txt', 'pdf', 'epub'],
    success: async (res) => {
      const files = res.tempFiles;
      
      // 触发开始回调（通常用于页面开启全局 Loading）
      if (onStart) onStart();

      const stats = {
        success: [],
        failed: [] 
      };

      for (let i = 0; i < files.length; i++) {
        const originalName = files[i].name;
        const finalTitle = sanitizeFileName(originalName);
        
        wx.showLoading({ title: `处理中(${i + 1}/${files.length})`, mask: true });
        
        try {
          const uploadRes = await new Promise((resolve, reject) => {
            wx.uploadFile({
              url: `${BASE_URL}/upload-file-to-bucket`,
              filePath: files[i].path,
              name: 'file',
              header: { 'x-user-id': userId },
              formData: { 
                bookTitle: finalTitle, 
                action: 'create',
                is_public: isPublic ? 'true' : 'false'
              },
              success: (r) => {
                try {
                  resolve(JSON.parse(r.data));
                } catch(e) {
                  reject(new Error('解析失败'));
                }
              },
              fail: reject
            });
          });

          if (uploadRes.ok) {
            stats.success.push(uploadRes.title || finalTitle);
          } else {
            stats.failed.push({ name: originalName, reason: uploadRes.msg || '服务器拒绝' });
          }
        } catch (err) {
          stats.failed.push({ name: originalName, reason: '网络超时' });
        }
      }

      wx.hideLoading();
      showUploadReport(stats);

      if (onSuccess) onSuccess(stats.success.length);
      if (onComplete) onComplete();
    },
    fail: () => {
      if (onComplete) onComplete();
    }
  });
};

/**
 * 内部私有：展示上传统计对话框
 */
const showUploadReport = (stats) => {
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
    confirmText: '确认'
  });
};

/**
 * 2. 封面更新 (仅限管理员)
 * 修正：增加了 onStart(bookId) 以便组件进入锁定状态
 */
export const universalUploadCover = (options) => {
  const { bookId, bookTitle, userId, isPublic = false, isAdmin, onStart, onSuccess, onComplete } = options;

  if (!isAdmin) {
    wx.showToast({ title: '权限不足', icon: 'none' });
    return;
  }

  wx.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    success: (res) => {
      const tempFilePath = res.tempFilePaths[0];
      const cleanTitle = sanitizeFileName(bookTitle);

      // 告诉页面：开始处理这本书了，组件要把这本书锁起来
      if (onStart) onStart(bookId);
      wx.showLoading({ title: '同步封面...', mask: true });

      wx.uploadFile({
        url: `${BASE_URL}/upload-file-to-bucket`,
        filePath: tempFilePath,
        name: 'file',
        header: { 'x-user-id': userId },
        formData: { 
          bookTitle: cleanTitle, 
          action: 'update_cover',
          is_public: isPublic ? 'true' : 'false' 
        },
        success: (uploadRes) => {
          try {
            const uploadData = JSON.parse(uploadRes.data);
            if (uploadData.ok) {
              wx.showToast({ title: '封面已同步' });
              if (onSuccess) onSuccess(uploadData.url);
            } else {
              wx.showModal({ title: '更新失败', content: uploadData.msg, showCancel: false });
            }
          } catch(e) {
            wx.showToast({ title: '响应解析失败', icon: 'none' });
          }
        },
        fail: () => wx.showToast({ title: '上传失败', icon: 'none' }),
        complete: () => {
          wx.hideLoading();
          if (onComplete) onComplete();
        }
      });
    }
  });
};

/**
 * 3. 通用批量删除
 */
export const universalBatchDelete = (options) => {
  const { userId, ids, isWarehouse = false, onSuccess, onComplete } = options;
  if (!ids || ids.length === 0) return;

  wx.showModal({
    title: isWarehouse ? '物理下架确认' : '移除书籍',
    content: `确定要${isWarehouse ? '从云端彻底删除' : '从个人书架移除'}这 ${ids.length} 本书吗？`,
    confirmColor: '#fa5151',
    confirmText: '确定删除',
    success: (res) => {
      if (res.confirm) {
        wx.showLoading({ title: '正在处理...', mask: true });
        wx.request({
          url: `${BASE_URL}/delete-books`,
          method: 'POST',
          header: { 'x-user-id': userId },
          data: { ids, is_warehouse: isWarehouse },
          success: (r) => {
            if (r.data && r.data.ok) {
              wx.showToast({ title: '清理成功' });
              if (onSuccess) onSuccess();
            } else {
              wx.showToast({ title: r.data.msg || '操作失败', icon: 'none' });
            }
          },
          fail: () => wx.showToast({ title: '网络请求失败', icon: 'none' }),
          complete: () => {
            wx.hideLoading();
            if (onComplete) onComplete();
          }
        });
      }
    }
  });
};