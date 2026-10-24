# 官方模组市场提交资料 · v1.0.0

提交入口：[Folium Compound 模组提交表单](https://github.com/chthollyphile/folium-compound/issues/new?template=mod-submission.yml)。流程依据[官方收录说明](https://github.com/chthollyphile/folium-compound#收录第三方模组)。提交社区模组使用 issue，不需要向市场仓库提交 PR。

## 表单字段

| 字段 | 填写内容 |
|---|---|
| 标题 | `[模组提交] BPM 歌词样式导演` |
| 模组 id / Mod id | `bpm-style-director` |
| 源码仓库 / Source repository | `https://github.com/LingShiQwQ/folia-bpm-style-director` |
| 版本 / Version (tag or commit) | `v1.0.0` |
| 模组目录 / Mod directory | `bpm-style-director` |
| 发布渠道 / Channel | 建议首发选择 `先行测试 / Beta`，因为依赖待弃用的内部控制能力，且仅适配 0.7.22 |
| 许可证 / License | `MIT` |

如希望申请正式发布，可以在表单中选择 `正式发布 / Release`，需要另通过功能审查；是否通过、是否降为先行测试由维护者决定。本文没有替你提交 issue，也没有表示已通过官方审核。

## 模组说明 / Description

按歌曲 BPM 区间自动选择 Folia 当前已加载的歌词动画，带完整中文设置页：可增删或拆分区间、选择内置或第三方样式、试算匹配、校正单曲 BPM、调整检测时长与置信度、管理检测记忆。

优先使用手动校正、歌曲元数据与 Folia 已有节拍缓存，再使用本模组检测记忆或本地音频估算。支持半拍/倍拍校正、快速切歌取消旧任务、手动切换后本曲暂停自动，以及停用时恢复原模式和随机开关。

仅适配 Folia 0.7.22 桌面版。设置采用新版 settings / onChange 接口。选择现有内置动画仍依赖 folium.internals，当前没有公开替代项，会出现弃用提示，不能承诺 Folium 2 兼容。BPM 只表示速度，估算可能出错，不等同于歌曲情绪。

AI 创作声明：主体代码、界面、测试、文档与介绍图由 OpenAI Codex 生成；需求、维护与发布为 LingShiQwQ。运行时不调用 AI 服务，不需要 API Key。源码采用 MIT 许可证，没有捆绑第三方运行时库。

## 权限说明 / Permissions

- `filesystem.data`：通过 `folium.storage` 保存设置、最多 500 首歌的 BPM 检测记忆和用户手动校正；不写音乐文件。
- `embedOrigins`：无。
- `experimental`：无。
- main 入口：无；不使用 Node 主进程代码。
- 内部接口：只在主窗口、Folia 0.7.22 使用 `folium.internals`，读取当前歌曲和播放 URL、已加载样式列表及样式状态，调用宿主原本的模式选择和随机开关动作。需要额外核查这项待弃用能力，不能以 `filesystem.data` 理解为沙箱边界。
- 宿主数据：只读访问 `KineticPlayerDB` 中匹配当前歌曲身份的节拍分析缓存，不写宿主缓存，不访问登录表、用户缓存表或凭据。
- 音频：读取当前播放音频，在本地解码和计算 BPM；不导出原始音频，不上传音频、歌词、BPM 或曲库。“允许额外读取在线播放音频”默认关闭，启用后只尝试 GET 当前播放 URL，不向新的第三方分析服务发送数据。来源访问限制仍然有效。
- 不下载或执行远程代码，不需要模型或 AI 密钥。

## 运行截图 / Screenshot

使用 [`folia-runtime.png`](folia-runtime.png)。这是实际 Folia 0.7.22 的 BPM 导演设置页，已验证挂载与当前歌曲估算信息。截图实例与发布包的运行代码一致，版本元数据差异及完整验证范围见 [VALIDATION.md](VALIDATION.md)。

**必须把这个 PNG 文件直接拖到 issue 表单的“运行截图 / Screenshot”输入框里上传。** 等 GitHub 生成附件链接后再提交。粘贴 README、仓库图片或 Release 的外部链接不满足官方截图检查。`preview.png` 是市场介绍图，不能代替运行截图。

## 确认项

请提交者阅读后在官方表单中自行勾选：

- 我是模组作者，或有权代表作者提交。
- 模组不收集或上传用户数据，也不下载并执行远程代码，除非这是明确声明的功能。
- 我了解每个新版本都要经过审查才会签名。

同一个模组 id 只开一个提交 issue；需要补充内容或变更版本时编辑原 issue。正式收录前，GitHub Release 中的安装包没有 Folium 官方签名，显示“未验证”。

## 附件对应关系

- `bpm-style-director/preview.png`：1280×720 介绍图，随模组目录签名。
- `docs/folia-runtime.png`：真实运行截图，提交时上传到 issue。
- `bpm-style-director-1.0.0.zip`：可安装的未签名社区发布包；官方从源码仓库的 tag / commit 取回目录审查。
- `SHA256SUMS.txt`：发布附件校验值。
- `SOURCE_COMMIT.txt`：发布 tag 实际指向的完整源码提交，用于核对；官方表单填写 `v1.0.0` 也可。
