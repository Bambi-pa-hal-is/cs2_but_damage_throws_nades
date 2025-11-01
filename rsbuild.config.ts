/// <reference types="node" />
import { defineConfig } from '@rsbuild/core';
import { Compiler, Compilation, sources, IgnorePlugin } from '@rspack/core';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

class AddImportAfterMinificationPlugin {
  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap('AddImportAfterMinificationPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'AddImportAfterMinificationPlugin',
          stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
        },
        (assets) => {
          for (const filename in assets) {
            if (filename.endsWith('.js')) {
              const asset = compilation.getAsset(filename);
              if (asset) {
                const newSource = 'import * as csScriptGlobals from "cs_script/point_script";\n';

                compilation.updateAsset(filename, new sources.ConcatSource(newSource, asset.source));
              }
            }
          }
        }
      );
    });
  }
}

export default defineConfig(() => {
  if (typeof process.env.PROJECT_SCRIPTS_PATH !== "string") {
    throw new Error("Please set PROJECT_SCRIPTS_PATH in your .env file to the path to your cs2 scripts folder, e.g. C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\content\\csgo_addons\\my_addon\\scripts");
  }

  const scriptsPath = resolve(__dirname, 'src/scripts');
  const scriptFiles = readdirSync(scriptsPath).filter(
    (file) => file.endsWith('.ts')
  );

  const entry = scriptFiles.reduce((acc, file) => {
    const name = file.replace('.ts', '');

    acc[name] = {
      import: [resolve(__dirname, 'src/registerGlobals.ts'), resolve(scriptsPath, file)],
      html: false,
    };

    return acc;
  }, {} as Record<string, { import: string[]; html: false }>);

  return {
    source: {
      entry,
    },
    output: {
      filenameHash: false,
      // This will completely clear the scripts folder, if you have outside scripts, make this false
      cleanDistPath: true,
      distPath: {
        root: process.env.PROJECT_SCRIPTS_PATH,
        js: ''
      },
      filename: {
        js: '[name].js',
      },
    },
    
    performance: {
      chunkSplit: {
        strategy: 'all-in-one',
      },
    },
    tools: {
    //   rspack: (config) => {
    //   config.externals = {
    //     "cs_script/point_script": "commonjs cs_script/point_script",
    //   };
    //   config.externals = "module";
    // },
      htmlPlugin: false,
    },
  }
});
