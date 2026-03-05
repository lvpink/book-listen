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
    const userId = app.globalData.userId;

    // 身份识别：如果是管理员，在 Page Data 里记录，方便组件和逻辑判断
    this.setData({
      isAdmin: userId === this.data.myAdminIdentifier
    });

    if (userId) {
      this.fetchMyBooks();
    } else {
      app.userIdReadyCallback = (id) => {
        if (id) {
          this.setData({
            isAdmin: id === this.data.myAdminIdentifier
          });
          this.fetchMyBooks();
        }
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
  uploadBook() {
    const uid = getApp().globalData.userId;
    if (!uid) return wx.showToast({
      title: '请先登录',
      icon: 'none'
    });

    // 获取组件实例，方便后续多次调用
    const rocketBtn = this.selectComponent('#uploader');

    universalUploadBook({
      userId: uid,
      isPublic: false,
      count: 5,
      onStart: () => {
        // --- 关键修正：确保只要点火了，特效就必须触发 ---
        if (rocketBtn) {
          console.log("火箭点火起飞");
          rocketBtn.launch();
        }
        // 不要让 fetchMyBooks 的 loading 影响这里
        this.setData({
          isUploading: true 
        });
      },
      onReportConfirm: () => {
        if (rocketBtn) {
          console.log("用户确认报告，火箭复位");
          rocketBtn.reset();
        }
      },
      onSuccess: (successCount) => {
        if (successCount > 0) {
          this.fetchMyBooks();
        }
      },
      onFail: (err) => {
        // 失败也要记得重置，否则图标一直消失
        if (rocketBtn) rocketBtn.reset();
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        });
      },
      onComplete: () => {
        this.setData({
          loading: false
        });
      }
    });
  },

  /**
   * 获取书架数据
   */
  fetchMyBooks() {
    const userId = getApp().globalData.userId;
    this.setData({
      loading: true
    });

    wx.request({
      url: 'https://rf3pmm2lnj.sealosbja.site/get-my-shelf',
      header: {
        'x-user-id': userId
      },
      success: (res) => {
        const books = res.data.data || [];
        this.setData({
          myBooks: books,
          loading: false
        }, () => {
          this.validateRecentBook(books);
        });
      },
      fail: () => {
        this.setData({
          loading: false
        });
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
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