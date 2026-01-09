const Verify = require('../../utils/verify.js');
const BASE_URL = "http://172.26.70.234:8000";

Page({
    data: {
        result: '等待操作...',
        userId: ''
    },

    onLoad() {
        //
    },

    handleInputId(e) {
        this.setData({
            userId: e.detail.value
        });
    },

    handleRegister() {
        if (!this.data.userId) {
            wx.showToast({
                title: '请输入User ID',
                icon: 'none'
            });
            return;
        }

        wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            sourceType: ['camera'],
            camera: 'front',
            success: (res) => {
                const tempFilePath = res.tempFiles[0].tempFilePath;
                wx.showLoading({ title: '注册中...' });

                wx.uploadFile({
                    url: `${BASE_URL}/api/face/register`,
                    filePath: tempFilePath,
                    name: 'file',
                    formData: {
                        'user_id': this.data.userId
                    },
                    success: (uploadRes) => {
                        wx.hideLoading();
                        console.log('Register Res:', uploadRes);

                        try {
                            const data = JSON.parse(uploadRes.data);
                            if (data.code === 200) {
                                this.setData({ result: `注册成功: ${this.data.userId}` });
                                wx.showToast({ title: '注册成功' });
                            } else {
                                this.setData({ result: `注册失败: ${data.msg}` });
                                wx.showToast({ title: '注册失败', icon: 'none' });
                            }
                        } catch (e) {
                            this.setData({ result: '注册失败: 解析错误' });
                        }
                    },
                    fail: (err) => {
                        wx.hideLoading();
                        this.setData({ result: `网络错误: ${err.errMsg}` });
                    }
                });
            }
        });
    },

    handleVerify() {
        console.log("Starting verify...");
        this.setData({ result: '正在核验...' });

        // 业务侧调用示例
        Verify.startVerify({
            data: {
                token: 'TEST_TOKEN_' + Date.now(), // 动态 Token
                startPath: ''
            },
            success: (res) => {
                console.log('Verify Success:', res);
                const now = new Date();
                const timeStr = now.toLocaleString(); // 简单格式化时间

                const successMsg = `签到成功！\n用户: ${res.verifyResult.userId}\n时间: ${timeStr}`;
                this.setData({ result: successMsg });

                wx.showModal({
                    title: '签到成功',
                    content: `用户: ${res.verifyResult.userId}\n时间: ${timeStr}`,
                    showCancel: false,
                    confirmText: '确定'
                });
            },
            fail: (err) => {
                console.log('Verify Fail:', err);
                const failMsg = '签到失败';
                this.setData({ result: failMsg });

                wx.showModal({
                    title: '签到失败',
                    content: err.errMsg || '未匹配到用户',
                    showCancel: false,
                    confirmText: '重试'
                });
            }
        });
    }
})
