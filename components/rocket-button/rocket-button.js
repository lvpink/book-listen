Component({
  data: {
    statusClass: '',
    isDisabled: false
  },
  methods: {
    handleTap() {
      // 这里的逻辑严格对应你提供的 JS
      if (this.data.statusClass === '' && !this.data.isDisabled) {
        this.setData({
          statusClass: 'upload-btn--running',
          isDisabled: true
        });

        // 模拟上传持续时间 (4000ms)
        setTimeout(() => {
          this.setData({
            statusClass: 'upload-btn--done'
          });

          // 动画彻底结束逻辑 (1500ms)
          setTimeout(() => {
            this.setData({
              statusClass: '',
              isDisabled: false
            });
            // 抛出完成事件给父组件
            this.triggerEvent('complete');
          }, 1500);
        }, 4000);
      }
    }
  }
})