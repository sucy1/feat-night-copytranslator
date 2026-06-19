import { env } from "../common/env";
import fs from "fs";

const defaultStyles = `
/* 自定义样式会在应用窗口加载后注入 */
/* 全局字体可作用于 Vuetify 根节点 */
.window-container .v-application {
    font-family: "微软雅黑","PingHei";
}

/* 专注模式文本区域 */
.focusText {
    /* 例如：font-family: Monaco; */
}

/* 对照模式原文/译文区域（横向/纵向） */
.hArea,
.vArea {
    /* 例如：line-height: 1.6; */
}

/* 词典面板 */
.dict {
    /* 例如：font-size: 14px; */
}
`;

let loadedStyles: undefined | string;

export function resetStyle() {
  fs.writeFileSync(env.style, defaultStyles);
}

function loadStyles(): string {
  if (loadedStyles) {
    return loadedStyles;
  }
  try {
    loadedStyles = <string>fs.readFileSync(env.style, "utf-8").toString();
    return loadedStyles;
  } catch (e) {
    resetStyle();
    loadedStyles = defaultStyles;
    return defaultStyles;
  }
}

export { loadStyles };
