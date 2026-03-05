// components/rocket-button/rocket-button.js
Component({
  data: {
    statusClass: '',
    isDisabled: false
  },
  methods: {
    launch() {
      if (this.data.statusClass !== '') return;
      this.setData({ statusClass: 'upload-btn--running', isDisabled: true });
    },

    // 关键：复位接口
    reset() {
      // 1. 先把状态切到隐藏/锁定，防止瞬间回弹的视觉冲击
      this.setData({ statusClass: 'upload-btn--done' });
      
      // 2. 延迟一小段时间（等组件在内存中重置位置）后，彻底恢复初始状态
      setTimeout(() => {
        this.setData({
          statusClass: '', 
          isDisabled: false
        });
      }, 300); // 300ms 足够完成后台位置重置
    },

    handleTap() {
      if (this.data.isDisabled) return;
      this.triggerEvent('btnclick');
    }
  }
})