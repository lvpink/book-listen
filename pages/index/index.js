// index.js (重构后 - 适配批量上传统计与权限隔离)
import {
  universalUploadBook,
  universalBatchDelete,
  universalUploadCover
} from '../../utils/bookUtils.js';

Page({
  data: {
    statusBarHeight: 20,
    menuBottom: 0,
    scrollTop: 0,
    myBooks: [],
    recentBook: null,
    loading: true,
    isEditMode: false,
    uploadingId: null,
    // 管理员识别码
    myAdminIdentifier: 'o1O_E5FkoWifja25vrEog_u7WvCE',
  },

  onLoad() {
    const {
      statusBarHeight
    } = wx.getWindowInfo();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    this.setData({
      statusBarHeight,
      menuBottom: menuButton.bottom + 5
    });
  },

  onShow() {
    this.checkRecent();
    const app = getApp();
    
    // 权限识别修正：封装成统一的更新与触发函数
    const updateAdminStatus = (id) => {
      const currentId = id || app.globalData.userId;
      const isAdmin = app.globalData.isAdmin || (currentId === this.data.myAdminIdentifier);
      
      this.setData({
        isAdmin: isAdmin,
        // 确保在尝试获取书架前，已经拿到了用户标识
        userId: currentId 
      });
  
      if (currentId) {
        this.fetchMyBooks();
      } else {
        // 如果依然没 ID，关闭加载动画，避免死循环转圈
        this.setData({ loading: false });
      }
    };
  
    if (app.globalData.userId) {
      // 场景 A：登录已完成，直接执行
      updateAdminStatus();
    } else {
      // 场景 B：登录进行中，通过 app.js 的回调触发
      // 增加一个防抖或重置，确保 loading 状态开启
      this.setData({ loading: true });
      
      app.userIdReadyCallback = (id) => {
        console.log('收到登录回调，开始同步书架...', id);
        updateAdminStatus(id);
      };
    }
  },

  // =================================================================
  // 1. 组件事件监听 (与 book-manager 对接)
  // =================================================================

  // 监听组件模式切换
  onModeChange(e) {
    this.setData({
      isEditMode: e.detail.isEditMode
    });
  },

  // 监听书籍点击
  onBookTap(e) {
    const book = e.detail.item;
    if (this.data.uploadingId === book._id) return;

    wx.vibrateShort({
      type: 'light'
    });
    wx.setStorageSync('last_read', book);
    wx.navigateTo({
      url: `/pages/player/player?id=${book._id}&title=${encodeURIComponent(book.title)}`
    });
  },

  // 监听批量删除
  handleBatchDelete(e) {
    const ids = e.detail.ids;
    universalBatchDelete({
      userId: getApp().globalData.userId,
      ids: ids,
      isWarehouse: false, // 仅从个人书架/私有桶移除
      onSuccess: () => {
        const manager = this.selectComponent('#bookManager');
        if (manager) manager.exitEditMode();
        this.fetchMyBooks();
      }
    });
  },

  // 响应组件内“换封面”按钮
  handleUpdateCoverEvent(e) {
    const {
      _id,
      title
    } = e.detail.item;
    this.doUploadCover(_id, title);
  },

  // 监听组件长按
  handleBookLongPress(e) {
    const book = e.detail.item;
    const manager = this.selectComponent('#bookManager');

    // 只有管理员 ID 才能看到“更新封面”选项
    if (this.data.isAdmin) {
      wx.showActionSheet({
        itemList: ['更新图书封面', '开启管理模式'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this.doUploadCover(book._id, book.title);
          } else if (res.tapIndex === 1) {
            manager.enterEditModeExternally(book._id);
          }
        }
      });
    } else {
      // 普通用户长按直接进入管理（删除）模式
      manager.enterEditModeExternally(book._id);
    }
  },

  // =================================================================
  // 2. 核心业务逻辑
  // =================================================================

  /**
   * 更新封面逻辑
   * 仅限管理员操作，会自动识别是更新公共书还是私有书
   */
  doUploadCover(bookId, bookTitle) {
    // 找到该书，确认其 public 属性
    const targetBook = this.data.myBooks.find(b => b._id === bookId);
    if (!targetBook) return;

    universalUploadCover({
      bookId: bookId,
      bookTitle: bookTitle,
      userId: getApp().globalData.userId,
      isAdmin: this.data.isAdmin,
      isPublic: targetBook.is_public || false,
      onStart: (id) => this.setData({
        uploadingId: id
      }),
      onSuccess: () => this.fetchMyBooks(),
      onComplete: () => this.setData({
        uploadingId: null
      })
    });
  },

  /**
   * 上传私人图书
   * 逻辑：调用工具类，工具类会自动处理批量统计和重命名
   */
/**
   * 上传私人图书
   */
uploadBook() {
  const app = getApp();
  if (!app.globalData.userId) return wx.showToast({ title: '请登录', icon: 'none' });

  const rocketBtn = this.selectComponent('#uploader');

  universalUploadBook({
    userId: app.globalData.userId,
    isPublic: false, // 强制私人模式
    count: 5,        // 配合你的 20 本限制，每次传 5 本比较稳
    onStart: () => {
      if (rocketBtn) rocketBtn.launch();
      this.setData({ isUploading: true });
    },
    onReportConfirm: () => {
      if (rocketBtn) rocketBtn.reset();
    },
    onSuccess: (successCount) => {
      if (successCount > 0) this.fetchMyBooks();
    },
    onFail: () => {
      if (rocketBtn) rocketBtn.reset();
    }
  });
},

  /**
   * 获取书架数据 (适配你最终的云函数名: get-my-shelf)
   */
  fetchMyBooks() {
    const app = getApp();
    // 核心：如果还没拿到 openid，不执行查询，直接结束加载
    if (!app.globalData.userId) {
      this.setData({ loading: false });
      return;
    }
  
    this.setData({ loading: true });
    console.log("openid:",app.globalData.userId)
    wx.request({
      url: 'https://gpge0t0fd7.sealosbja.site/get-my-shelf',
      method: 'GET',
      data: { 
        type: 'private',
        openid: app.globalData.userId // 修正点：直接传 openid
      },
      success: (res) => {
        console.log("booksRes:",res)
        // 只要服务器响应了（无论 code 是 200 还是空数据），就关闭 loading
        const books = res.data.data || [];
        const formattedBooks = books.map(b => ({
          ...b,
          title: b.book_tag,
          cover: b.cover_url || '/assets/default_cover.png'
        }));
  
        this.setData({
          myBooks: formattedBooks,
          loading: false // 必须设为 false
        });
      },
      fail: (err) => {
        console.error('书架同步失败', err);
        this.setData({ loading: false }); // 失败也要关闭
      }
    });
  },

  // =================================================================
  // 3. 辅助功能
  // =================================================================

  checkRecent() {
    const last = wx.getStorageSync('last_read');
    if (last) {
      const currentPos = wx.getStorageSync('pos_' + last._id) || 0;
      let progressText = currentPos > 0 ? `已读 ${Math.floor(currentPos / 1024)} KB` : '尚未开始';
      this.setData({
        recentBook: {
          ...last,
          progressStatus: progressText
        }
      });
    }
  },

  validateRecentBook(currentBooks) {
    const lastRead = wx.getStorageSync('last_read');
    if (!lastRead) return;
    if (!currentBooks.some(b => b._id === lastRead._id)) {
      wx.removeStorageSync('last_read');
      this.setData({
        recentBook: null
      });
    }
  },

  goToWarehouse() {
    wx.navigateTo({
      url: '/pages/warehouse/warehouse'
    });
  }
});