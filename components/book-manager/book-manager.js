Component({
  properties: {
    books: {
      type: Array,
      value: [],
      observer: function (newVal) {
        if (newVal) {
          this.initBookColors(newVal);
        }
      }
    },
    isAdmin: { type: Boolean, value: false },
    menuBottom: Number,
    uploadingId: String,
    showProgress: {
      type: Boolean,
      value: true 
    },
  },
  data: {
    isEditMode: false,
    selectedIds: [],
    selectedMap: {},
    _books: [] 
  },
  methods: {
    initBookColors(books) {
      const comfortColors = [
        '#A3B18A', '#588157', '#DAD7CD', '#B8C1EC', '#A29BFE', 
        '#D6E4FF', '#F4A261', '#E9C46A', '#F1DCA7', '#BC8A5F', 
        '#8B5E3C', '#D4A373', '#E8D7D0', '#F5EBE0', '#D5BDAF', 
        '#8E9AAF', '#CBC0D3', '#EFD3D2', '#9DB4C0', '#C2DFE3'
      ];

      const processedBooks = books.map((book, index) => {
        if (!book.cover_url && !book.bgColor) {
          book.bgColor = comfortColors[index % comfortColors.length];
        }
        return book;
      });

      this.setData({ _books: processedBooks });
    },

    onLongPress(e) {
      if (this.data.isEditMode) return;
      const item = e.currentTarget.dataset.item;
      if (this.data.uploadingId === item._id) return;
      wx.vibrateShort({ type: 'medium' });
      this.triggerEvent('booklongpress', { item });
    },

    enterEditModeExternally() {
      this.setData({ 
        isEditMode: true,
        selectedIds: [],
        selectedMap: {}
      });
      this.triggerEvent('modechange', { isEditMode: true });
    },

    onTap(e) {
      const item = e.currentTarget.dataset.item;
      if (this.data.uploadingId === item._id) return;
      if (this.data.isEditMode) {
        this.toggleSelect(item._id);
      } else {
        this.triggerEvent('itemtap', { item });
      }
    },

    toggleSelect(id) {
      let { selectedMap, selectedIds } = this.data;
      if (selectedMap[id]) {
        delete selectedMap[id];
        selectedIds = selectedIds.filter(v => v !== id);
      } else {
        selectedMap[id] = true;
        selectedIds.push(id);
      }
      this.setData({ 
        selectedMap: { ...selectedMap }, 
        selectedIds 
      });
      wx.vibrateShort({ type: 'light' });
    },

    exitEditMode() {
      this.setData({
        isEditMode: false,
        selectedIds: [],
        selectedMap: {}
      });
      this.triggerEvent('modechange', { isEditMode: false });
    },

    onBatchDelete() {
      console.log("utils开始删除：",this.data)
      if (this.data.selectedIds.length === 0) return;
      this.triggerEvent('batchdelete', { ids: this.data.selectedIds });
    },

    onUpdateCover(e) {
      const item = e.currentTarget.dataset.item;
      this.triggerEvent('updatecover', { item });
    }
  }
})