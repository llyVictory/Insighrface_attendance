<template>
	<view class="container">
		<!-- 顶部 Banner 区 -->
		<view class="banner">
			<text class="title">智慧考勤</text>
			<text class="subtitle">Face Verification System</text>
		</view>

		<!-- 核心操作区 -->
		<view class="action-area">
			<view class="circle-btn" @click="startVerify" hover-class="btn-hover">
				<text class="btn-text">刷脸</text>
				<text class="btn-text">签到</text>
			</view>
			<text class="hint-text">点击按钮开启人脸识别</text>
		</view>

		<!-- 结果展示卡片 -->
		<view class="result-card" v-if="verifyResult.show">
			<view class="card-header">
				<text class="card-title">考勤结果</text>
				<text :class="['status-tag', verifyResult.success ? 'success' : 'fail']">
					{{ verifyResult.success ? '成功' : '失败' }}
				</text>
			</view>
			
			<view class="card-body">
				<view class="info-row">
					<text class="label">当前时间：</text>
					<text class="value">{{ verifyResult.time }}</text>
				</view>

				<view class="info-row" v-if="verifyResult.userId">
					<text class="label">学生姓名：</text>
					<text class="value highlight">{{ verifyResult.userId }}</text>
				</view>
				<view class="info-row" v-if="verifyResult.address">
					<text class="label">考勤位置：</text>
					<text class="value">{{ verifyResult.address }}</text>
				</view>
				<view class="info-row" v-if="!verifyResult.success">
					<text class="label">失败原因：</text>
					<text class="value error">{{ verifyResult.msg }}</text>
				</view>
			</view>
		</view>
	</view>

</template>

<script>
	// 引入SDK核心类
	import QQMapWX from '@/static/js/qqmap-wx-jssdk.min.js';

	export default {
		data() {
			return {
				// 本地测试  wsl ip
				baseUrl: 'http://172.26.70.234:8000', 
				
				// 真机测试,wsl要链接电脑wifi。然后找到ipv4.并且打开转发： netsh interface portproxy add v4tov4 listenport=8000 listenaddress=0.0.0.0 connectport=8000 connectaddress=172.26.70.234
				// baseUrl: 'http://192.168.137.1:8000', 
				mapKey: 'TY5BZ-LBNCH-2OLDM-W2KXB-RLO6Z-3OFPX',
				qqmapsdk: null,
				currentAddress: '',
				verifyResult: {
					show: false,
					success: false,
					time: '',
					userId: '',
					msg: '',
					address: ''
				}
			}
		},
		onLoad() {
			// 实例化API核心类
			this.qqmapsdk = new QQMapWX({
				key: this.mapKey
			});
		},
		methods: {
			startVerify() {
				console.log('Starting verification...');
				// 1. 先尝试获取位置
				this.getLocation().then(() => {
					this.openCamera();
				}).catch(() => {
					uni.showModal({
						title: '提示',
						content: '获取位置失败，是否继续考勤？(将记录为未知位置)',
						success: (res) => {
							if (res.confirm) {
								this.currentAddress = '未知位置(获取失败)';
								this.openCamera();
							}
						}
					});
				});
			},

			openCamera() {
				// 2. 调起摄像头
				uni.chooseMedia({
					count: 1,
					mediaType: ['image'],
					sourceType: ['camera'],
					camera: 'front',
					success: (res) => {
						const tempFilePath = res.tempFiles[0].tempFilePath;
						this.uploadImage(tempFilePath);
					},
					fail: (err) => {
						console.log('Camera cancelled', err);
					}
				});
			},

			getLocation() {
				return new Promise((resolve, reject) => {
					uni.showLoading({ title: '定位中...' });
					uni.getLocation({
						type: 'gcj02',
						isHighAccuracy: true,
						success: (res) => {
							console.log('Location success:', res);
							this.resolveAddress(res.latitude, res.longitude).then(addr => {
								this.currentAddress = addr;
								uni.hideLoading();
								resolve();
							});
						},
						fail: (err) => {
							console.error('Location fail:', err);
							uni.hideLoading();
							// 如果是模拟器，可能需要配置模拟位置
							reject(err);
						}
					});
				});
			},

			resolveAddress(lat, lng) {
				return new Promise((resolve) => {
					this.qqmapsdk.reverseGeocoder({
						location: {
							latitude: lat,
							longitude: lng
						},
						sig: this.mapKey, // JSSDK 验证需要
						success: (res) => {
							console.log('SDK Success:', res);
							const addr = res.result.address_component.province +
										 res.result.address_component.city +
										 res.result.address_component.district +
										 (res.result.formatted_addresses ? res.result.formatted_addresses.recommend : res.result.address);
							resolve(addr);
						},
						fail: (res) => {
							console.error('SDK Fail:', res);
							resolve(`位置解析失败(${res.message})`);
						}
					});
				});
			},

			uploadImage(filePath) {
				uni.showLoading({ title: '身份核验中...' });
				
				// 2. 上传后端
				uni.uploadFile({
					url: `${this.baseUrl}/api/face/verify`,
					filePath: filePath,
					name: 'file',
					formData: {
						'token': 'UNIAPP_TOKEN_' + Date.now(),
						'address': this.currentAddress // 发送地址
					},
					success: (uploadRes) => {
						uni.hideLoading();
						if (uploadRes.statusCode !== 200) {
							this.showResult(false, null, 'Server Error: ' + uploadRes.statusCode);
							return;
						}

						try {
							const result = JSON.parse(uploadRes.data);
							// Backend returns 'address' field now too, but we can use local
							const addr = result.address || this.currentAddress; 
							
							if (result.code === 200 && result.isMatch) {
								this.showResult(true, result.userId, 'Success', addr);
							} else {
								this.showResult(false, result.userId, result.msg || '未录入或未匹配到', addr);
							}
						} catch (e) {
							this.showResult(false, null, 'JSON Parse Error');
						}
					},
					fail: (err) => {
						uni.hideLoading();
						this.showResult(false, null, 'Network Error: ' + err.errMsg);
					}
				});
			},

			showResult(success, userId, msg, address) {
				const now = new Date();
				this.verifyResult = {
					show: true,
					success: success,
					time: this.formatDate(now),
					userId: userId || '未知',
					msg: msg,
					address: address || '未知'
				};

				if (success) {
					uni.showToast({ title: '签到成功', icon: 'success' });
				} else {
					uni.vibrateLong(); // 震动反馈
				}
			},

            formatDate(date) {
                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                const hour = date.getHours().toString().padStart(2, '0');
                const minute = date.getMinutes().toString().padStart(2, '0');
                const second = date.getSeconds().toString().padStart(2, '0');
                return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
            }
		}
	}
</script>

<style>
	.container {
		padding: 0;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		background: linear-gradient(180deg, #e3f2fd 0%, #f5f7fa 100%);
	}

	.banner {
		width: 100%;
		height: 200rpx;
		background-color: #1976d2;
		color: white;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;  /* Added for horizontal centering */
		border-bottom-left-radius: 40rpx;
		border-bottom-right-radius: 40rpx;
		box-shadow: 0 4rpx 10rpx rgba(25, 118, 210, 0.3);
		margin-bottom: 60rpx;
	}

	.title {
		font-size: 40rpx;
		font-weight: bold;
		letter-spacing: 2rpx;
	}

	.subtitle {
		font-size: 24rpx;
		opacity: 0.8;
		margin-top: 10rpx;
	}

	.action-area {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-bottom: 50rpx;
	}

	.circle-btn {
		width: 300rpx;
		height: 300rpx;
		border-radius: 50%;
		background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		box-shadow: 0 10rpx 30rpx rgba(33, 150, 243, 0.4);
		transition: transform 0.1s;
	}

	.btn-hover {
		transform: scale(0.95);
		opacity: 0.9;
	}

	.btn-text {
		color: white;
		font-size: 36rpx;
		font-weight: bold;
		line-height: 1.5;
	}

	.hint-text {
		margin-top: 30rpx;
		color: #909399;
		font-size: 28rpx;
	}

	.result-card {
		width: 90%;
		background: white;
		border-radius: 20rpx;
		padding: 30rpx;
		box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
		animation: slideUp 0.3s ease-out;
	}

	@keyframes slideUp {
		from { transform: translateY(20px); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20rpx;
		border-bottom: 1px solid #eee;
		padding-bottom: 20rpx;
	}

	.card-title {
		font-size: 32rpx;
		font-weight: bold;
		color: #333;
	}

	.status-tag {
		padding: 6rpx 20rpx;
		border-radius: 30rpx;
		font-size: 24rpx;
		font-weight: bold;
	}

	.status-tag.success {
		background-color: #e8f5e9;
		color: #2e7d32;
	}

	.status-tag.fail {
		background-color: #ffebee;
		color: #c62828;
	}

	.card-body {
		display: flex;
		flex-direction: column;
		gap: 16rpx;
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		font-size: 28rpx;
	}

	.label {
		color: #666;
		flex-shrink: 0; /* 防止标签换行 */
	}

	.value {
		color: #333;
		font-family: monospace;
		text-align: right;
		/* 处理长文本 */
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 70%; /* 限制最大宽度 */
		font-size: 24rpx; /* 调小字体 */
	}

	.value.highlight {
		color: #1976d2;
		font-weight: bold;
		font-size: 32rpx;
	}

	.value.error {
		color: #d32f2f;
	}
</style>
