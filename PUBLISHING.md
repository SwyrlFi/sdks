# 发布指南

本项目使用 Changesets 来管理版本和发布流程。Changesets 会自动处理 `workspace:*` 协议，在发布时将其转换为实际版本号。

## 正式版本发布流程

### 1. 创建变更记录
```bash
yarn changeset
```
按照提示选择：
- 哪些包需要更新
- 版本类型（major/minor/patch）
- 写变更描述

### 2. 更新版本
```bash
yarn changeset:version
```
这会根据 changesets 更新所有包的版本号，并将 `workspace:*` 转换为实际版本。

### 3. 构建并发布
```bash
yarn changeset:publish
```

## Alpha/Beta 预发布流程

### 发布 Alpha 版本

1. 进入 alpha 预发布模式
```bash
yarn changeset:pre:enter:alpha
```

2. 创建变更记录
```bash
yarn changeset
```

3. 更新版本（会生成 alpha 版本号）
```bash
yarn changeset:version
```

4. 发布 alpha 版本
```bash
yarn changeset:publish:alpha
```

5. 完成后退出预发布模式
```bash
yarn changeset:pre:exit
```

### 发布 Beta 版本

1. 进入 beta 预发布模式
```bash
yarn changeset:pre:enter:beta
```

2. 创建变更记录
```bash
yarn changeset
```

3. 更新版本（会生成 beta 版本号）
```bash
yarn changeset:version
```

4. 发布 beta 版本
```bash
yarn changeset:publish:beta
```

5. 完成后退出预发布模式
```bash
yarn changeset:pre:exit
```

## 版本号规则

- **正式版**: `1.0.0`, `1.0.1`, `1.1.0`
- **Alpha 版**: `1.0.0-alpha.0`, `1.0.0-alpha.1`
- **Beta 版**: `1.0.0-beta.0`, `1.0.0-beta.1`

## 注意事项

1. Changesets 会自动处理包之间的依赖关系
2. `workspace:*` 会在发布时自动转换为实际版本号
3. 所有包都会发布到 npm 公开仓库（配置为 `"access": "public"`）
4. `uniswapx-integration` 包已被忽略，不会被发布

## 常用命令

- `yarn changeset` - 创建新的变更记录
- `yarn changeset:version` - 根据变更记录更新版本
- `yarn changeset:publish` - 发布正式版本
- `yarn changeset:publish:alpha` - 发布 alpha 版本
- `yarn changeset:publish:beta` - 发布 beta 版本
- `yarn changeset:pre:enter:alpha` - 进入 alpha 预发布模式
- `yarn changeset:pre:enter:beta` - 进入 beta 预发布模式
- `yarn changeset:pre:exit` - 退出预发布模式