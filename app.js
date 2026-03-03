App({
  globalData: { userId: null },
  onLaunch() {
    this.login();
  },
  login() {
    return new Promise((resolve) => {
      wx.login({
        success: async (res) => {
          if (res.code) {
            // 调用上面创建的 Laf 云函数
            wx.request({
              url: 'https://rf3pmm2lnj.sealosbja.site/get-book-openid',
              method: 'POST',
              data: { code: res.code },
              success: (loginRes) => {
                if (loginRes.data.ok) {
                  const openid = loginRes.data.openid;
                  this.globalData.userId = openid;
                  // 存一份到缓存作为备份，但逻辑上以 globalData 为准
                  wx.setStorageSync('userId', openid);
                  resolve(openid);
                  
                  // 发送一个自定义事件，通知首页 ID 拿到了
                  if (this.userIdReadyCallback) {
                    this.userIdReadyCallback(openid);
                  }
                }
              }
            });
          }
        }
      });
    });
  }
})