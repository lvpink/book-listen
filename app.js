App({
  globalData: {
    userId: null,
    isAdmin: false
  },

  onLaunch() {
    this.login();
  },

  login() {
    wx.login({
      success: (res) => {
        if (res.code) {
          // 第一步：换取 OpenID
          wx.request({
            url: 'https://gpge0t0fd7.sealosbja.site/get-book-openId',
            method: 'POST',
            data: { code: res.code },
            success: (loginRes) => {
              console.log("loginRes:",loginRes)
              if (loginRes.data.ok) {
                const openid = loginRes.data.openid;
                wx.setStorageSync('userId', openid);

                // 第二步：去 handle-user-login 登记并检查 isAdmin
                this.registerUser(openid);
              }
            }
          });
        }
      }
    });
  },

  registerUser(openid) {
    wx.request({
      url: 'https://gpge0t0fd7.sealosbja.site/handle-user-login',
      method: 'POST',
      data: { openid: openid }, // 直接把 openid 发过去
      success: (regRes) => {
        if (regRes.data.code === 200) {
          this.globalData.userId = openid;
          this.globalData.isAdmin = regRes.data.isAdmin;

          if (this.userIdReadyCallback) {
            this.userIdReadyCallback(openid);
          }
          console.log('登录成功，管理员状态:', regRes.data.isAdmin);
        }
      }
    });
  }
})