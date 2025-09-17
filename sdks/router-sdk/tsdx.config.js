module.exports = {
  rollup(config, options) {
    // 确保 TypeScript 插件正确处理符号链接
    const typescript = config.plugins.find(
      plugin => plugin.name === 'rpt2'
    );

    if (typescript && typescript.options) {
      typescript.options.tsconfigOverride = {
        ...typescript.options.tsconfigOverride,
        compilerOptions: {
          ...typescript.options.tsconfigOverride?.compilerOptions,
          preserveSymlinks: true,
          skipLibCheck: true,
        }
      };
    }

    return config;
  },
};