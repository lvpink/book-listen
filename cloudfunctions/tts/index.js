const cloud = require('wx-server-sdk');
const axios = require('axios'); // 需在云函数目录下 npm install axios

cloud.init();

exports.main = async (event, context) => {
  const { text, voice } = event;
  
  // 这里填入你从火山引擎获取的 AppID 和 Token
  const APPID = "你的APPID";
  const TOKEN = "你的TOKEN";

  try {
    const response = await axios.post('https://openspeech.bytedance.com/api/v1/tts', {
      app: { appid: APPID, token: TOKEN, cluster: "volcano_tts" },
      user: { uid: "user_123" },
      audio: { voice_type: voice, encoding: "mp3" },
      request: { text: text }
    });

    // 将生成的音频流存入云存储，并返回临时链接给前端
    const upload = await cloud.uploadFile({
      cloudPath: `audio/${Date.now()}.mp3`,
      fileContent: Buffer.from(response.data.data, 'base64'),
    });

    return { audioUrl: upload.fileID };
  } catch (err) {
    return { err };
  }
};