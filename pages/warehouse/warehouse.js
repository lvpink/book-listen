// pages/warehouse/warehouse.js
import { 
  universalUploadBook, 
  universalUploadCover, 
  universalBatchDelete 
} from '../../utils/bookUtils.js';

Page({
  data: {
    // --- 权限与状态 ---
    isAdmin: false,
    myAdminIdentifier: 'o1O_E5FkoWifja25vrEog_u7WvCE', 
    isSearching: false, 
    isEditMode: false,  
    loading: true,
    
    // --- 布局适配 ---
    statusBarHeight: 20,
    menuBottom: 0,
    
    // --- 数据源 ---
    allBooks: [],      
    displayBooks: [],  
    searchQuery: '',   
    
    // --- 交互状态 ---
    uploadingId: null  
  },

  onLoad() {
    const info = wx.getWindowInfo();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    
    // 初始化身份 (从 getApp 获取，如果是异步登录需在 onShow 再次校验)
    this.checkAdminIdentity();

    this.setData({
      statusBarHeight: info.statusBarHeight,
      menuBottom: menuButton.bottom + 5,
    });

    this.fetchWarehouseBooks();
  },

  onShow() {
    // 每次进入页面重新检查身份，防止登录态变更
    this.checkAdminIdentity();
  },

  checkAdminIdentity() {
    const userId = getApp().globalData.userId;
    this.setData({
      isAdmin: userId === this.data.myAdminIdentifier
    });
  },

  // =================================================================
  // 1. 数据拉取
  // =================================================================

  fetchWarehouseBooks() {
    const uid = getApp().globalData.userId;
    this.setData({ loading: true });
    
    wx.request({
      url: 'https://rf3pmm2lnj.sealosbja.site/get-warehouse-books',
      method: 'GET',
      header: { 'x-user-id': uid || '' },
      success: (res) => {
        console.log("res",res)
        if (res.data.ok) {
          const books = res.data.data || [];
          this.setData({ 
            allBooks: books,
            displayBooks: books 
          });
        }
      },
      fail: () => {
        wx.showToast({ title: '加载仓库失败', icon: 'none' });
      },
      complete: () => {
        this.setData({ loading: false });
      }
    });
  },

  // =================================================================
  // 2. 管理员操作 (调用 bookUtils)
  // =================================================================

  /**
   * 管理员：批量上传公共书籍
   */
  handleBatchUploadPublic() {
    if (!this.data.isAdmin) return;
    const uid = getApp().globalData.userId;
    // 获取组件实例，方便后续多次调用
    const rocketBtn = this.selectComponent('#uploader');
    universalUploadBook({
      userId: uid,
      isPublic: true, 
      count: 9, 
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
      // onStart: () => this.setData({ loading: true }),
      onSuccess: (successCount) => {
        if (successCount > 0) this.fetchWarehouseBooks();
      },
      onFail: (err) => {
        // 失败也要记得重置，否则图标一直消失
        if (rocketBtn) rocketBtn.reset();
        wx.showToast({
          title: '上传失败',
          icon: 'none'
        });
      },
      onComplete: () => this.setData({ loading: false })
    });
  },

  /**
   * 监听组件发出的更新封面请求
   */
  handleUpdateCoverEvent(e) {
    const { item } = e.detail;
    const uid = getApp().globalData.userId;

    universalUploadCover({
      bookId: item._id,
      bookTitle: item.title,
      userId: uid,
      isAdmin: this.data.isAdmin, 
      isPublic: true, 
      onStart: (id) => this.setData({ uploadingId: id }),
      onSuccess: () => this.fetchWarehouseBooks(),
      onComplete: () => this.setData({ uploadingId: null })
    });
  },

  /**
   * 监听组件发出的批量删除请求
   */
  handleBatchDelete(e) {
    const { ids } = e.detail;
    console.log("开始删除：",e)
    const uid = getApp().globalData.userId;

    universalBatchDelete({
      userId: uid,
      ids: ids,
      isWarehouse: true, 
      onSuccess: () => {
        const manager = this.selectComponent('#bookManager');
        if (manager) manager.exitEditMode();
        this.fetchWarehouseBooks();
      }
    });
  },

  // =================================================================
  // 3. 搜索与交互
  // =================================================================

  onSearchInput(e) {
    const query = e.detail.value.trim().toLowerCase();
    this.setData({ searchQuery: query });

    if (!query) {
      this.setData({ displayBooks: this.data.allBooks });
      return;
    }

    const filtered = this.data.allBooks.filter(book => 
      book.title.toLowerCase().includes(query)
    );
    this.setData({ displayBooks: filtered });
  },

  enableSearch() { this.setData({ isSearching: true }); },
  disableSearch() { 
    this.setData({ isSearching: false, searchQuery: '', displayBooks: this.data.allBooks }); 
  },

  /**
   * 收藏到书架
   */
  confirmAddToShelf(book) {
    const uid = getApp().globalData.userId;
    if (!uid) return wx.showToast({ title: '请先登录', icon: 'none' });

    wx.showLoading({ title: '正在加入...', mask: true });
    wx.request({
      url: 'https://rf3pmm2lnj.sealosbja.site/add-to-shelf',
      method: 'POST',
      header: { 'x-user-id': uid },
      data: { bookId: book._id },
      success: (res) => {
        if (res.data.ok) {
          wx.showToast({ title: '已成功收藏', icon: 'success' });
          this.fetchWarehouseBooks();
        } else {
          wx.showToast({ title: res.data.msg || '添加失败', icon: 'none' });
        }
      },
      fail: () => wx.showToast({ title: '网络故障', icon: 'none' }),
      complete: () => wx.hideLoading()
    });
  },

  // =================================================================
  // 4. 组件事件对接
  // =================================================================

  onModeChange(e) {
    this.setData({ isEditMode: e.detail.isEditMode });
  },

  /**
   * 处理书籍点击 (对接组件的 itemtap)
   */
  onBookTap(e) {
    const { item } = e.detail;
    if (this.data.isEditMode) return; 

    if (item.inShelf) {
      wx.showModal({
        title: '温馨提示',
        content: `《${item.title}》已在书架，是否现在去阅读？`,
        confirmText: '立即阅读',
        success: (res) => {
          if (res.confirm) wx.switchTab({ url: '/pages/index/index' });
        }
      });
      return;
    }

    wx.showActionSheet({
      itemList: ['加入我的书架'],
      success: (res) => {
        if (res.tapIndex === 0) this.confirmAddToShelf(item);
      }
    });
  },

  /**
   * 处理长按 (对接组件的 booklongpress)
   */
  handleBookLongPress(e) {
    if (!this.data.isAdmin) return;
    const { item } = e.detail;
    const book = e.detail.item;
    const manager = this.selectComponent('#bookManager');

    // 只有管理员 ID 才能看到“更新封面”选项
      wx.showActionSheet({
        itemList: ['更新图书封面', '开启管理模式'],
        success: (res) => {
          if (res.tapIndex === 0) {
            this.doUploadCover(book._id, book.title);
          } else if (res.tapIndex === 1) {
            manager.enterEditModeExternally(item._id);
          }
        }
      });
  },
  /**
   * 更新封面逻辑
   * 仅限管理员操作，会自动识别是更新公共书还是私有书
   */
  doUploadCover(bookId, bookTitle) {
    // 找到该书，确认其 public 属性
    const targetBook = this.data.allBooks.find(b => b._id === bookId);
    if (!targetBook) return;

    universalUploadCover({
      bookId: bookId,
      bookTitle: bookTitle,
      userId: getApp().globalData.userId,
      isAdmin: this.data.isAdmin,
      isPublic: targetBook.is_public || false,
      onStart: (id) => this.setData({ uploadingId: id }),
      onSuccess: () => this.fetchWarehouseBooks(),
      onComplete: () => this.setData({ uploadingId: null })
    });
  }
  // handleBookLongPress(e) {
  //   if (!this.data.isAdmin) return;
  //   const { item } = e.detail;
  //   const manager = this.selectComponent('#bookManager');
  //   // 如果是管理员，直接进入针对该书的选择管理模式
  //   if (manager) manager.enterEditModeExternally(item._id);
  // }
});