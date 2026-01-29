import { defineConfig } from 'vitepress'
import { globSync } from 'glob'
import path from 'path'
import fs from 'fs'

// 自動生成側邊欄的 helper function
function getSidebar() {
  const sidebar = {}
  
  // 找出所有第一層的目錄 (e.g., 01_學習計劃, 02_C語言...)
  const dirs = fs.readdirSync(__dirname + '/..').filter(f => {
    return fs.statSync(__dirname + '/../' + f).isDirectory() && 
           !f.startsWith('.') && 
           f !== 'node_modules'
  }).sort()

  dirs.forEach(dir => {
    // 針對每個目錄，找出裡面的 .md 檔案
    const files = globSync(`${dir}/*.md`, { cwd: path.resolve(__dirname, '..') }).sort()
    
    if (files.length > 0) {
      sidebar[`/${dir}/`] = [
        {
          text: dir.replace(/^\d+_/, ''), // 去掉前面的數字 (01_學習計劃 -> 學習計劃)
          items: files.map(file => {
            const name = path.basename(file, '.md')
            return { text: name, link: `/${file}` }
          })
        }
      ]
    }
  })

  return sidebar
}

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "NextJob 韌體面試庫",
  description: "BMC / System Firmware Engineer Interview Preparation",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '首頁', link: '/' },
      { text: '學習計劃', link: '/01_學習計劃/技能評估表' },
      { text: 'C語言', link: '/02_C語言/位元運算練習' },
      { text: 'OpenBMC', link: '/04_OpenBMC深化/架構複習' }
    ],

    sidebar: getSidebar(),

    socialLinks: [
      // 如果有 repo 可以放
      // { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ],

    search: {
      provider: 'local',
      options: {
        translations: {
          button: {
            buttonText: '搜尋文件',
            buttonAriaLabel: '搜尋文件'
          },
          modal: {
            noResultsText: '無法找到相關結果',
            resetButtonTitle: '清除查詢條件',
            footer: {
              selectText: '選擇',
              navigateText: '切換',
              closeText: '關閉'
            }
          }
        }
      }
    },

    outline: {
      label: '本頁目錄'
    },

    docFooter: {
      prev: '上一頁',
      next: '下一頁'
    },

    lastUpdated: {
      text: '最後更新於',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'short'
      }
    }
  }
})
