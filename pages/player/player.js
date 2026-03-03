/** pages/player/player.js **/
const InnerAudioContext = wx.createInnerAudioContext();

Page({
  data: {
    bookId: '',
    bookInfo: {},
    isPlaying: false,
    showTheater: false, // 是否开启AI剧情演绎
    progress: 0,
    currentChapter: "正在加载...",
    duration: "00:00",
    currentTime: "00:00",
    
    // AI动画相关
    stickmanPos: { x: 150, y: 120 },
    animationTimer: null
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ bookId: options.id });
      this.fetchBookDetail(options.id);
    }
  },

  onUnload() {
    InnerAudioContext.stop();
    this.stopAnimation();
  },

  // 从 Laf 获取书籍详情与文件
  async fetchBookDetail(id) {
    wx.showLoading({ title: '准备书本...' });
    try {
      // 假设你的 Laf 函数名为 get-book-detail
      const res = await wx.cloud.callFunction({
        name: 'get-book-detail',
        data: { id }
      });
      
      this.setData({ bookInfo: res.result });
      this.initAudio(res.result.file_url);
    } catch (e) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  // 初始化音频控制
  initAudio(url) {
    InnerAudioContext.src = url;
    
    InnerAudioContext.onPlay(() => this.setData({ isPlaying: true }));
    InnerAudioContext.onPause(() => this.setData({ isPlaying: false }));
    InnerAudioContext.onTimeUpdate(() => {
      const cur = InnerAudioContext.currentTime;
      const dur = InnerAudioContext.duration;
      this.setData({
        currentTime: this.formatTime(cur),
        duration: this.formatTime(dur),
        progress: (cur / dur) * 100
      });
      
      // 每隔一定时间根据进度更新AI动画动作
      if (this.data.showTheater) {
        this.updateAIAction(cur);
      }
    });
  },

  // 播放/暂停
  togglePlay() {
    if (this.data.isPlaying) {
      InnerAudioContext.pause();
    } else {
      InnerAudioContext.play();
    }
  },

  // 进度条跳转
  seek(e) {
    const val = e.detail.value;
    const pos = (val / 100) * InnerAudioContext.duration;
    InnerAudioContext.seek(pos);
  },

  // --- AI 剧情演绎逻辑 (火柴人) ---

  toggleTheater(e) {
    const status = e.detail.value;
    this.setData({ showTheater: status });
    if (status) {
      this.startAnimation();
    } else {
      this.stopAnimation();
    }
  },

  startAnimation() {
    const query = wx.createSelectorQuery();
    query.select('#stickmanCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);
        
        this.canvasCtx = ctx;
        this.animate();
      });
  },

  // 核心渲染循环
  animate() {
    if (!this.data.showTheater) return;
    
    const ctx = this.canvasCtx;
    // 清屏
    ctx.clearRect(0, 0, 400, 300);
    
    // 根据当前音频进度，模拟火柴人动作（实际应根据后端传回的Action序列）
    this.drawStickman(ctx, this.data.stickmanPos.x, this.data.stickmanPos.y);
    
    this.data.animationTimer = setTimeout(() => {
      this.animate();
    }, 100); // 10帧/秒 足够呈现火柴人效果
  },

  // 绘制火柴人基础模型
  drawStickman(ctx, x, y) {
    // 头部
    ctx.beginPath();
    ctx.arc(x, y - 30, 15, 0, Math.PI * 2);
    ctx.stroke();
    
    // 身体
    ctx.beginPath();
    ctx.moveTo(x, y - 15);
    ctx.lineTo(x, y + 30);
    
    // 手部 (随进度产生简单的摆动感)
    const wave = Math.sin(Date.now() / 200) * 10;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 20, y + 10 + wave); // 左手
    ctx.moveTo(x, y);
    ctx.lineTo(x + 20, y + 10 - wave); // 右手
    
    // 腿部
    ctx.moveTo(x, y + 30);
    ctx.lineTo(x - 15, y + 60); // 左腿
    ctx.moveTo(x, y + 30);
    ctx.lineTo(x + 15, y + 60); // 右腿
    
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 3;
    ctx.stroke();
  },

  stopAnimation() {
    clearTimeout(this.data.animationTimer);
  },

  // 工具：格式化时间
  formatTime(secs) {
    let min = Math.floor(secs / 60);
    let sec = Math.floor(secs % 60);
    return (min < 10 ? '0' + min : min) + ":" + (sec < 10 ? '0' + sec : sec);
  },
  
  // 后期扩展：根据文本时间戳更新剧情画面动作
  updateAIAction(time) {
    // 这里可以根据 time 匹配后端下发的剧情节点 JSON
    // 例如：if(time > 10 && time < 12) this.setData({ action: 'fighting' })
  }
})