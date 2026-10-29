import numpy as np
import scipy.signal
import sounddevice as sd
import threading
import time
import matplotlib.pyplot as plt
from collections import Counter
import argparse
import sys
import os

#python bpm.py --test-device 1
#python bpm.py --device 1
#python bpm.py --list-devices
class BPMDetector:
    def __init__(self, sample_rate=44100, buffer_duration=5, update_interval=1, device=None):
        self.sample_rate = sample_rate
        self.buffer_duration = buffer_duration  # 缓冲区持续时间（秒）
        self.update_interval = update_interval  # BPM更新间隔（秒）
        self.buffer_size = int(self.sample_rate * self.buffer_duration)
        self.audio_buffer = np.zeros(self.buffer_size, dtype=np.float32)
        self.device = device  # 音频设备
        self.current_bpm = None
        self.running = False
        self.lock = threading.Lock()
        
        # 初始化BPM历史记录，用于平滑结果
        self.bpm_history = []
        self.history_size = 5
        
        # 添加音频设备测试标志
        self.device_tested = False
    
    def audio_callback(self, indata, frames, time, status):
        """实时音频回调函数"""
        if status:
            print(f"音频回调状态: {status}")
            
        # 将新数据添加到缓冲区
        with self.lock:
            data = indata[:, 0] if indata.shape[1] > 0 else indata.flatten()
            self.audio_buffer = np.roll(self.audio_buffer, -len(data))
            self.audio_buffer[-len(data):] = data
    
    def update_bpm(self):
        """定期更新BPM计算"""
        while self.running:
            with self.lock:
                audio_data = self.audio_buffer.copy()
            
            # 计算BPM
            bpm = self.calculate_bpm(audio_data)
            if bpm:
                # 添加到历史记录中
                self.bpm_history.append(bpm)
                if len(self.bpm_history) > self.history_size:
                    self.bpm_history.pop(0)
                
                # 使用历史记录中的中位数作为当前BPM
                if self.bpm_history:
                    self.current_bpm = np.median(self.bpm_history)
                    print(f"当前BPM: {self.current_bpm:.1f}")
            
            # 等待下一次更新
            time.sleep(self.update_interval)
    
    def start(self):
        """开始监听音频并更新BPM"""
        self.running = True
        
        # 启动BPM更新线程
        self.update_thread = threading.Thread(target=self.update_bpm)
        self.update_thread.daemon = True
        self.update_thread.start()
        
        # 列出可用设备（仅供信息）
        print("可用音频设备:")
        try:
            devices = sd.query_devices()
            for i, device in enumerate(devices):
                print(f"{i}: {device['name']} (输入通道: {device['max_input_channels']}, 输出通道: {device['max_output_channels']})")
        except Exception as e:
            print(f"列出设备时出错: {e}")
        
        # 检查设备是否有效
        try:
            if self.device is not None:
                device_info = sd.query_devices(self.device)
                if device_info['max_input_channels'] <= 0:
                    print(f"警告: 选择的设备 {self.device} 没有输入通道!")
                    self._suggest_stereo_mix_fix()
                    return
                
                print(f"使用音频设备: {device_info['name']}")
            else:
                print("使用默认音频输入设备")
        except Exception as e:
            print(f"获取设备信息时出错: {e}")
            self._suggest_stereo_mix_fix()
            return
            
        # 启动音频流（使用更强大的错误处理）
        try:
            self.stream = sd.InputStream(
                device=self.device,
                channels=1,
                samplerate=self.sample_rate,
                callback=self.audio_callback,
                blocksize=1024,  # 设置较小的块大小以减少延迟
                latency='low'    # 使用低延迟设置
            )
            self.stream.start()
            self.device_tested = True
            print(f"开始监听音频设备: {self.device}...")
        except Exception as e:
            print(f"打开音频流时出错: {e}")
            self._suggest_stereo_mix_fix()
            self.running = False
            return
    
    def stop(self):
        """停止监听音频"""
        self.running = False
        if hasattr(self, 'stream'):
            self.stream.stop()
            self.stream.close()
        if hasattr(self, 'update_thread'):
            self.update_thread.join(timeout=1)
        print("停止监听音频.")
    
    def apply_low_pass_filter(self, data, cutoff=100):
        """应用低通滤波器以突出低频（鼓声）"""
        nyquist = 0.5 * self.sample_rate
        normal_cutoff = cutoff / nyquist
        b, a = scipy.signal.butter(4, normal_cutoff, btype='low')
        filtered_data = scipy.signal.filtfilt(b, a, data)
        return filtered_data
    
    def get_peaks(self, data, threshold=0.5):
        """识别音频数据中的峰值"""
        data_abs = np.abs(data)
        max_value = np.max(data_abs)
        
        if max_value < 0.01:  # 音量太小，可能没有播放音乐
            return []
            
        normalized_data = data_abs / max_value  # 归一化
        
        # 找出高于阈值的峰值
        peaks = []
        min_interval = int(self.sample_rate * 0.1)  # 最小峰值间隔（100ms）
        
        i = 0
        while i < len(normalized_data):
            if normalized_data[i] > threshold:
                peaks.append(i)
                # 跳过一段时间以避免同一个峰值被多次检测
                i += min_interval
            else:
                i += 1
        
        return peaks
    
    def count_intervals_between_peaks(self, peaks):
        """计算峰值之间的间隔"""
        intervals = []
        for i, peak in enumerate(peaks):
            # 查看后面的几个峰值
            for j in range(1, min(10, len(peaks) - i)):
                interval = peaks[i + j] - peak
                intervals.append(interval)
        
        return intervals
    
    def intervals_to_bpm_candidates(self, intervals):
        """将峰值间隔转换为可能的BPM值"""
        bpm_candidates = []
        
        for interval in intervals:
            # 将间隔（样本数）转换为秒
            interval_seconds = interval / self.sample_rate
            
            # 计算理论上的BPM
            theoretical_bpm = 60 / interval_seconds
            
            # 调整BPM使其落在90-180范围内
            while theoretical_bpm < 90:
                theoretical_bpm *= 2
            while theoretical_bpm > 180:
                theoretical_bpm /= 2
            
            bpm_candidates.append(round(theoretical_bpm, 1))
        
        return bpm_candidates
    
    def find_most_common_bpm(self, bpm_candidates, tolerance=1.0):
        """找出最常见的BPM值"""
        if not bpm_candidates:
            return None
        
        # 统计BPM候选值
        counter = Counter(bpm_candidates)
        bpm_counts = {}
        
        # 将相近的BPM值合并
        for bpm in sorted(counter.keys()):
            if not bpm_counts:
                bpm_counts[bpm] = counter[bpm]
                continue
                
            # 检查是否可以合并到现有的BPM组
            merged = False
            for existing_bpm in list(bpm_counts.keys()):
                if abs(existing_bpm - bpm) <= tolerance:
                    # 合并到现有组
                    new_bpm = (existing_bpm * bpm_counts[existing_bpm] + bpm * counter[bpm]) / (bpm_counts[existing_bpm] + counter[bpm])
                    new_count = bpm_counts[existing_bpm] + counter[bpm]
                    del bpm_counts[existing_bpm]
                    bpm_counts[round(new_bpm, 1)] = new_count
                    merged = True
                    break
            
            if not merged:
                bpm_counts[bpm] = counter[bpm]
        
        # 按计数排序
        sorted_bpms = sorted(bpm_counts.items(), key=lambda x: x[1], reverse=True)
        
        if not sorted_bpms:
            return None
            
        # 检查是否有三连音节奏（4/3倍关系）
        best_bpm, best_count = sorted_bpms[0]
        triplet_bpm = best_bpm * 4/3
        
        for bpm, count in sorted_bpms[1:]:
            if abs(bpm - triplet_bpm) <= tolerance and count > best_count * 0.7:
                # 如果存在三连音节奏且计数接近最大值，则选择较低的BPM
                return best_bpm
        
        return best_bpm
    
    def calculate_bpm(self, audio_data):
        """计算音频数据的BPM"""
        # 应用低通滤波
        filtered_data = self.apply_low_pass_filter(audio_data)
        
        # 检查音频级别
        rms = np.sqrt(np.mean(np.square(filtered_data)))
        if rms < 0.005:  # 静音检测阈值
            if self.device_tested:  # 仅在设备已测试后才显示
                print("未检测到音频信号。请确保有音乐正在播放，且音量足够大（一般是16以上）。")
            return None
        
        # 识别峰值
        peaks = self.get_peaks(filtered_data)
        
        # 如果找不到足够的峰值，返回None
        if len(peaks) < 4:
            return None
        
        # 计算峰值间隔
        intervals = self.count_intervals_between_peaks(peaks)
        
        # 将间隔转换为BPM候选值
        bpm_candidates = self.intervals_to_bpm_candidates(intervals)
        
        # 找出最常见的BPM
        most_common_bpm = self.find_most_common_bpm(bpm_candidates)
        
        return most_common_bpm
    
    def _suggest_stereo_mix_fix(self):
        """针对立体声混音问题提供建议"""
        if self.device is not None and "立体声混音" in str(sd.query_devices(self.device)).lower():
            print("\n可能是立体声混音设备的问题。请尝试以下步骤:")
            print("1. 右键点击系统托盘中的音量图标，选择'打开声音设置'")
            print("2. 滚动到'输入'部分，点击'声音控制面板'")
            print("3. 切换到'录制'选项卡")
            print("4. 右键点击空白处，确保'显示禁用的设备'已勾选")
            print("5. 找到'立体声混音'设备，右键点击并选择'启用'")
            print("6. 右键点击它，选择'设为默认设备'")
            print("7. 点击'确定'并重启程序\n")
            print("或者尝试使用其他输入设备，例如麦克风")

def list_devices():
    """列出所有可用的音频设备"""
    print("可用音频设备:")
    try:
        devices = sd.query_devices()
        for i, device in enumerate(devices):
            input_channels = device['max_input_channels']
            output_channels = device['max_output_channels']
            
            # 添加设备类型标记
            device_type = ""
            if "立体声混音" in device['name']:
                device_type = " [系统声音录制]"
            elif input_channels > 0 and "麦克风" in device['name']:
                device_type = " [麦克风]"
            elif output_channels > 0 and ("扬声器" in device['name'] or "耳机" in device['name']):
                device_type = " [音频输出]"
                
            print(f"{i}: {device['name']}{device_type} (输入通道: {input_channels}, 输出通道: {output_channels})")
    except Exception as e:
        print(f"列出设备时出错: {e}")

def test_audio_device(device_id, duration=3):
    """测试指定的音频设备是否可正常捕获音频"""
    print(f"正在测试设备 {device_id}，请确保有音频播放...")
    try:
        # 录制短暂的音频
        data = sd.rec(int(44100 * duration), samplerate=44100, channels=1, device=device_id)
        sd.wait()
        
        # 分析录制的音频
        rms = np.sqrt(np.mean(np.square(data)))
        peak = np.max(np.abs(data))
        
        print(f"测试结果: RMS 音量: {rms:.6f}, 峰值: {peak:.6f}")
        
        if rms < 0.01:
            print("警告: 未检测到足够的音频信号!")
            if "立体声混音" in str(sd.query_devices(device_id)).lower():
                print("这是一个立体声混音设备，可能需要在系统中启用它。")
        else:
            print("设备测试通过!")
        
        return True
    except Exception as e:
        print(f"测试设备时出错: {e}")
        return False

# 主函数
def main():
    parser = argparse.ArgumentParser(description='实时音乐BPM检测器')
    parser.add_argument('--device', type=int, help='要使用的音频设备ID')
    parser.add_argument('--list-devices', action='store_true', help='列出所有可用的音频设备')
    parser.add_argument('--test-device', type=int, help='测试指定的音频设备')
    parser.add_argument('--sample-rate', type=int, default=44100, help='采样率（默认: 44100）')
    parser.add_argument('--buffer-duration', type=int, default=5, help='音频缓冲区持续时间，单位秒（默认: 5）')
    parser.add_argument('--update-interval', type=float, default=1, help='BPM更新间隔，单位秒（默认: 1）')
    
    args = parser.parse_args()
    
    if args.list_devices:
        list_devices()
        return
        
    if args.test_device is not None:
        test_audio_device(args.test_device)
        return
    
    # 检查是否为Windows系统和立体声混音设备
    if args.device is not None and sys.platform == 'win32':
        try:
            device_info = sd.query_devices(args.device)
            if "立体声混音" in device_info['name']:
                print("\n注意: 您选择了Windows立体声混音设备。")
                print("如果遇到问题，请确保此设备已在Windows声音设置中启用。\n")
        except Exception:
            pass
    
    detector = BPMDetector(
        sample_rate=args.sample_rate,
        buffer_duration=args.buffer_duration,
        update_interval=args.update_interval,
        device=args.device
    )
    
    try:
        detector.start()
        
        # 如果设备测试不通过，直接退出
        if not detector.running:
            return
            
        # 保持程序运行
        print("按Ctrl+C停止程序")
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\n程序被用户中断")
    except Exception as e:
        print(f"发生错误: {e}")
    finally:
        detector.stop()

if __name__ == "__main__":
    main()
