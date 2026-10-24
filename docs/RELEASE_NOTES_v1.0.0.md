# BPM 歌词样式导演 v1.0.0

首个公开发布版本。AI 创作：OpenAI Codex；需求、维护与发布：LingShiQwQ。

- 按自定义 BPM 区间选择歌词动画，带完整中文设置界面。
- 本地节拍估算、记忆、单曲校正、半拍/倍拍修正。
- 手动接管保护、快速切歌取消、停用恢复原样式。
- 设置部分采用当前 `settings` / `onChange` 接口。

**适配：仅 Folia 0.7.22 桌面版。** 切换现有模式仍依赖待弃用的 `folium.internals`，会显示相关提示，没有 Folium 2 兼容承诺。唯一声明权限是 `filesystem.data`；检测在本地完成，额外读取在线播放音频默认关闭。

从下面的附件下载 `bpm-style-director-1.0.0.zip`，拖入 Folia 模组面板安装；`SHA256SUMS.txt` 提供校验值。本发布包未经过 Folium 官方签名，显示“未验证”；市场提交资料见仓库 docs。
