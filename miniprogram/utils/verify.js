const BASE_URL = "http://172.26.70.234:8000"; // WSL IP Code Update

/**
 * 模拟微信核身组件调用 (Backend Service version)
 * @param {Object} options
 * @param {Object} options.data - { token, startPath }
 * @param {Function} options.success
 * @param {Function} options.fail
 */
function startVerify(options) {
    const { data, success, fail } = options;

    if (!data || !data.token) {
        if (fail) fail({ errCode: 1001, errMsg: 'Missing token parameter' });
        return;
    }

    // 1. 调起相机拍摄
    wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera'],
        camera: 'front', // 前置摄像头
        success: (res) => {
            const tempFilePath = res.tempFiles[0].tempFilePath;

            // 显示交互 loading
            wx.showLoading({ title: '身份核验中...', mask: true });

            // 2. 上传图片到后端
            wx.uploadFile({
                url: `${BASE_URL}/api/face/verify`,
                filePath: tempFilePath,
                name: 'file',
                formData: {
                    'token': data.token
                },
                success: (uploadRes) => {
                    wx.hideLoading();

                    if (uploadRes.statusCode !== 200) {
                        if (fail) fail({ errCode: uploadRes.statusCode, errMsg: 'Server Error' });
                        return;
                    }

                    try {
                        const result = JSON.parse(uploadRes.data);

                        if (result.code === 200 && result.isMatch) {
                            // 模拟官方的延时体验
                            setTimeout(() => {
                                if (success) success({
                                    token: data.token, // 回传 token
                                    verifyResult: result // 附带详细信息
                                });
                            }, 500);
                        } else {
                            if (fail) fail({
                                errCode: result.code,
                                errMsg: result.msg || '人脸不匹配',
                                score: result.score
                            });
                        }
                    } catch (e) {
                        if (fail) fail({ errCode: 500, errMsg: 'Invalid JSON response' });
                    }
                },
                fail: (e) => {
                    wx.hideLoading();
                    if (fail) fail({ errCode: 1003, errMsg: 'Network Request Failed: ' + e.errMsg });
                }
            });
        },
        fail: (e) => {
            // 这里的 fail 通常是用户取消了相机
            if (fail) fail({ errCode: 1002, errMsg: 'User cancelled or camera error: ' + e.errMsg });
        }
    });
}

module.exports = {
    startVerify
};
