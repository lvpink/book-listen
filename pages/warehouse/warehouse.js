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
    keyboardHeight: 0,
    // --- 交互状态 ---
    uploadingId: null  
  },

  onLoad() {
    const info = wx.getWindowInfo();
    const menuButton = wx.getMenuButtonBoundingClientRect();
    
    // 初始化身份
    this.checkAdminIdentity();

    this.setData({
      statusBarHeight: info.statusBarHeight || 20,
      menuBottom: menuButton.bottom + 5,
    });

    this.fetchWarehouseBooks();
  },

  onShow() {
    this.checkAdminIdentity();
  },

  checkAdminIdentity() {
    const userId = getApp().globalData.userId;
    this.setData({
      isAdmin: userId === this.data.myAdminIdentifier
    });
  },

  /**
   * 键盘高度监听：配合 WXSS 中的 transform: translateY 实现搜索框随键盘平滑升起
   */
  onKeyboardHeightChange(e) {
    const { height } = e.detail;
    this.setData({
      keyboardHeight: height > 0 ? height : 0
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
        if (res.data.ok) {
          const books = res.data.data || [];
          this.setData({ 
            allBooks: books,
            // 保持当前搜索结果或全量显示
            displayBooks: this.data.searchQuery ? this.filterBooks(this.data.searchQuery, books) : books 
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
  // 2. 管理员操作
  // =================================================================

  handleBatchUploadPublic() {
    if (!this.data.isAdmin) return;
    const uid = getApp().globalData.userId;
    const rocketBtn = this.selectComponent('#uploader');
    
    universalUploadBook({
      userId: uid,
      isPublic: true, 
      count: 9, 
      onStart: () => {
        if (rocketBtn) rocketBtn.launch();
        this.setData({ isUploading: true });
      }, 
      onReportConfirm: () => {
        if (rocketBtn) rocketBtn.reset();
      },    
      onSuccess: (successCount) => {
        if (successCount > 0) this.fetchWarehouseBooks();
      },
      onFail: (err) => {
        if (rocketBtn) rocketBtn.reset();
        wx.showToast({ title: '上传失败', icon: 'none' });
      },
      onComplete: () => this.setData({ loading: false })
    });
  },

  /**
   * 清除搜索文字：点击苹果风格的那个小叉号触发
   */
  clearSearch() {
    this.setData({ 
      searchQuery: '',
      displayBooks: this.data.allBooks,
      // 保持聚焦状态，方便用户重新输入
      isSearching: true 
    });
  },

  /**
   * 批量删除监听
   */
  handleBatchDelete(e) {
    const { ids } = e.detail;
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
  // 3. 搜索与交互逻辑
  // =================================================================

  onSearchInput(e) {
    const query = e.detail.value.trim().toLowerCase();
    this.setData({ searchQuery: query });
    this.setData({ displayBooks: this.filterBooks(query, this.data.allBooks) });
  },

  // 抽离出的过滤逻辑，方便多处复用
  filterBooks(query, books) {
    if (!query) return books;
    return books.filter(book => 
      book.title.toLowerCase().includes(query)
    );
  },

  enableSearch() { 
    this.setData({ isSearching: true }); 
  },

  disableSearch() {
    this.setData({ 
      isSearching: false, 
      searchQuery: '',
      displayBooks: this.data.allBooks,
      keyboardHeight: 0 
    });
    // 收起键盘
    wx.hideKeyboard();
  },

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

  handleBookLongPress(e) {
    if (!this.data.isAdmin) return;
    const { item } = e.detail;
    const manager = this.selectComponent('#bookManager');

    wx.showActionSheet({
      itemList: ['更新图书封面', '开启管理模式'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.doUploadCover(item._id, item.title);
        } else if (res.tapIndex === 1) {
          if (manager) manager.enterEditModeExternally(item._id);
        }
      }
    });
  },

  /**
   * 统一封面上传逻辑
   */
  doUploadCover(bookId, bookTitle) {
    const targetBook = this.data.allBooks.find(b => b._id === bookId);
    if (!targetBook) return;

    universalUploadCover({
      bookId: bookId,
      bookTitle: bookTitle,
      userId: getApp().globalData.userId,
      isAdmin: this.data.isAdmin,
      isPublic: true, // 听书库默认为公共书籍
      onStart: (id) => this.setData({ uploadingId: id }),
      onSuccess: () => this.fetchWarehouseBooks(),
      onComplete: () => this.setData({ uploadingId: null })
    });
  }
});