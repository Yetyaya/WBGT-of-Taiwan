<script setup lang="ts">
import { ref, onMounted, computed, inject } from 'vue'
import * as d3 from 'd3'

const cityNameCn = ref<String>('臺灣')
const cityNameEn = ref<String>('Taiwan')
const date = new Date()
const time = {
  year: date.getFullYear(),
  month: date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1,
  date: date.getDate() < 10 ? `0${date.getDate()}` : date.getDate(),
  hour: date.getHours() < 10 ? `0${date.getHours()}` : date.getHours(),
  minute: date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes(),
  second: date.getSeconds() < 10 ? `0${date.getSeconds()}` : date.getSeconds()
}

//- 定義 熱傷害指數
const heatInjuryIndex = {
  notice: 32,
  alert: 34,
  danger: 36,
  exDanger: 38
}

let screenWidth = ref<number>(0)
let screenHeight = ref<number>(0)
let centerTranslateX = ref<number>(2)
let centerTranslateY = ref<number>(2.5)
let mercatorScale = ref<number>(11000)

let taiwanMap = d3.select('#taiwanMap')
let taiwanSvg

function resizeWindow() {
  screenWidth.value = document.documentElement.scrollWidth
  screenHeight.value = document.documentElement.scrollHeight
  if (screenWidth.value >= 1300) {
    mercatorScale.value = 11000
    centerTranslateX.value = 2
    centerTranslateY.value = 2.5
  } else if (screenWidth.value > 1024 && screenWidth.value < 1300) {
    mercatorScale.value = 9000
    centerTranslateX.value = 1.9
    centerTranslateY.value = 2.5
  } else if (screenWidth.value >= 768 && screenWidth.value <= 1024) {
    mercatorScale.value = 9000
    centerTranslateX.value = 1.8
    centerTranslateY.value = 2.3
  } else if (screenWidth.value > 540 && screenWidth.value < 768) {
    mercatorScale.value = 6000
    centerTranslateX.value = 1.7
    centerTranslateY.value = 3.2
  } else if (screenWidth.value > 320 && screenWidth.value <= 540) {
    mercatorScale.value = 6000
    centerTranslateX.value = 1.65
    centerTranslateY.value = 2.7
  } else if (screenWidth.value <= 320) {
    mercatorScale.value = 5000
    centerTranslateX.value = 1.65
    centerTranslateY.value = 2.7
  } else {
    mercatorScale.value = 7500
    centerTranslateX.value = 1.45
    centerTranslateY.value = 2.5
  }
}

function refreshSvg() {
  // 清除 台灣地圖 svg
  taiwanSvg = d3.select('#taiwanMap svg').remove()
  // 重新宣告台灣地圖 svg
  taiwanSvg = taiwanMap.append('svg')
  draw(taiwanData.value, screenWidth.value, screenHeight.value)
}

function refreshWindow() {
  resizeWindow()
  refreshSvg()
}

const showDefine = ref<Boolean>(false)
const selectedCountyCurrentData = ref<Array<any> | null>()
const selectedCountState = ref<String | null>(null)

//- 獲取全局對象
const global: any = inject('global')
const weatherData = ref<Array<any> | null>(null)
const taiwanData = ref<Array<any> | null>(null)
const countyData = ref<Array<any> | null>(null)
const townData = ref<Array<any> | null>(null)
const selectTown = ref<String | null>(null)

onMounted(() => {
  window.addEventListener('resize', refreshWindow)

  const getWeatherData = async () => {
    //- 取得 健康氣象熱傷害指數及警示全台各鄉鎮五日逐三小時預報
    await global.axios
      .get(
        'https://opendata.cwa.gov.tw/api/v1/rest/datastore/M-A0085-001?Authorization=CWA-89D02268-53B1-411D-A2DF-6656C7FDF8EE&format=JSON'
      )
      .then((res: any) => {
        weatherData.value = res.data.records.Locations
      })
      .catch((err: any) => {
        console.log(err)
      })

    //- 取得 台灣地圖 資料
    await global.axios
      .get('./json/county.json')
      .then((res: any) => {
        resizeWindow()
        if (res.data) {
          taiwanData.value = res.data
          draw(taiwanData.value, screenWidth.value, screenHeight.value)
        }
      })
      .catch((err: any) => {
        console.log(err)
      })
  }
  getWeatherData()
})

const townSelectArr = ref<Array<any>>([])
function draw(mapData: any, width: number, height: number) {
  taiwanMap = d3.select('#taiwanMap')

  taiwanSvg = taiwanMap
    .select('svg')
    .attr('style', `width: ${width}px; height: ${height}px`)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .append('g')
    .attr('class', 'mainIsland')
    .append('g')
    .attr('class', 'counties')

  taiwanSvg = taiwanMap.select('g.mainIsland').append('path').attr('class', 'countyBorders')
  taiwanSvg = taiwanMap.select('svg').append('g').attr('class', 'countyText')

  //- 創建一個地圖投影
  const projectMethod = d3
    .geoMercator()
    .center([121, 24])
    .scale(mercatorScale.value)
    .translate([width / centerTranslateX.value, height / centerTranslateY.value])
  //- 地理路徑生成器
  const pathGenerator = d3.geoPath().projection(projectMethod)

  //- 縣市區塊
  taiwanSvg = taiwanMap
    .select('g.mainIsland g.counties')
    .selectAll('path')
    .data(topojson.feature(mapData, mapData.objects['COUNTY_MOI_1130718']).features)
    .enter()
    .append('g')
    .attr('class', (d: any) => indexRangeLevel(d))
    .attr('data-county-cn', (d: any) => d.properties['COUNTYNAME'])
    .attr('data-county-en', (d: any) => d.properties['COUNTYENG'])
    .attr('data-county-code', (d: any) => d.properties['COUNTYCODE'])
    .attr('data-county-id', (d: any) => d.properties['COUNTYID'])
    .append('path')
    .attr('d', pathGenerator)
    .on('click', (d: any) => {
      clickCounty(d)
    })

  function clickCounty(d: any) {
    selectTown.value = ''
    openDetail.value = false
    const dataset = d.target.__data__.properties
    cityNameCn.value = dataset.COUNTYNAME // 換中文名
    cityNameEn.value = dataset.COUNTYENG // 換英文名

    //- 有 .selected 存在，就移除 .selected
    if (document.querySelectorAll('.selected')) {
      document.querySelectorAll('.selected').forEach((item) => {
        item.classList.remove('selected')
      })
    }

    //- 被點擊的縣市加上 .selected
    document
      .getElementsByClassName('county' + cityNameEn.value.split(' ').join(''))[0]
      .classList.add('selected')
    document
      .getElementsByClassName('county' + cityNameEn.value.split(' ').join(''))[1]
      .classList.add('selected')

    selectedCountyCurrentData.value = getCurrentData(cityNameCn.value).sort((a: any, b: any) => {
      return b['HeatInjuryIndex'] - a['HeatInjuryIndex']
    })

    const selectedCountIndex = ref<Number | null>(null)
    selectedCountIndex.value = Math.max(
      ...getCurrentData(cityNameCn.value).map((item: any) => {
        return item.HeatInjuryIndex
      })
    )

    if (
      selectedCountIndex.value >= heatInjuryIndex.notice &&
      selectedCountIndex.value < heatInjuryIndex.alert
    ) {
      selectedCountState.value = legendArr.value[1].title
    } else if (
      selectedCountIndex.value >= heatInjuryIndex.alert &&
      selectedCountIndex.value < heatInjuryIndex.danger
    ) {
      selectedCountState.value = legendArr.value[2].title
    } else if (
      selectedCountIndex.value >= heatInjuryIndex.danger &&
      selectedCountIndex.value < heatInjuryIndex.exDanger
    ) {
      selectedCountState.value = legendArr.value[3].title
    } else if (selectedCountIndex.value >= heatInjuryIndex.exDanger) {
      selectedCountState.value = legendArr.value[4].title
    } else {
      selectedCountState.value = legendArr.value[0].title
    }

    weatherData.value.forEach((item: any) => {
      if (item.CountyName == cityNameCn.value) {
        townSelectArr.value = item.Location.map((item2: any) => {
          return {
            label: item2.TownName,
            value: item2.TownName
          }
        })
        countyData.value = item
      }
    })
  }

  //- 縣市分界線
  taiwanSvg = taiwanMap.select('g.mainIsland path.countyBorders').attr(
    'd',
    pathGenerator(
      topojson.mesh(mapData, mapData.objects['COUNTY_MOI_1130718'], function (a: any, b: any) {
        return a !== b
      })
    )
  )

  //- 縣市文字
  taiwanSvg = taiwanMap
    .select('g.countyText')
    .selectAll('path')
    .data(topojson.feature(mapData, mapData.objects['COUNTY_MOI_1130718']).features)
    .enter()
    .append('g')
    .attr('class', (d: any) => indexRangeLevel(d))
    .attr('data-county-cn', (d: any) => d.properties['COUNTYNAME'])
    .attr('data-county-en', (d: any) => d.properties['COUNTYENG'])
    .attr('data-county-code', (d: any) => d.properties['COUNTYCODE'])
    .attr('data-county-id', (d: any) => d.properties['COUNTYID'])
    .on('click', (d: any) => {
      clickCounty(d)
    })

  taiwanSvg = taiwanMap
    .select('g.countyText')
    .selectAll('.county')
    .append('svg')
    .attr('class', 'levelIconBg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('x', (d: any) => textPositionX(d) - 27)
    .attr('y', (d: any) => textPositionY(d) - 35)
    .append('g')
    .append('path')
    .attr(
      'd',
      'M14.93,47.84V41l-3.7-2.73L4.9,40.13l-.24-.23,3.45-5.78L6.38,29.67.05,28.07l0-.32,6-3.11.76-4.75L2.17,15.13A11.17,11.17,0,0,1,5.4,15c1.09,0,2.19,0,3.49,0l2.79-3.53L9.87,4.94l.28-.18L15.91,8l4.54-1.76L22,0l.32-.08,3.21,6,4.55.79L35,1.46A49.75,49.75,0,0,1,35,8.62l3.76,2.94,6.5-1.92.18.22L42,15.68l1.72,4.45,6.22,1.59L50,22l-6,3.2-.71,4.53,4.76,4.9c-2.32.45-4.52,0-6.78,0l-2.9,3.66c.49,2.17,1.5,4.26,1.71,6.93L34,42,29.6,43.73,28,50.09l-.27,0-3.17-6-4.61-.79L15.21,48ZM9.85,21.91c.35-.51.74-1,1.05-1.53A17,17,0,0,1,15.79,15c5.88-4,12.12-5.18,18.84-2.2.06,0,.16,0,.24-.06-1.44-1.67-5.4-3.5-8-3.75a15,15,0,0,0-13.55,5.36,12.94,12.94,0,0,0-3.44,7.56l0,0C9.82,22.07,9.84,22,9.85,21.91Z'
    )

  taiwanSvg = taiwanMap
    .select('g.countyText')
    .selectAll('.county')
    .append('svg')
    .attr('class', 'levelIcon')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('x', (d: any) => textPositionX(d) - 26)
    .attr('y', (d: any) => textPositionY(d) - 34)
    .append('g')
    .append('path')
    .attr(
      'd',
      'M14.93,47.84V41l-3.7-2.73L4.9,40.13l-.24-.23,3.45-5.78L6.38,29.67.05,28.07l0-.32,6-3.11.76-4.75L2.17,15.13A11.17,11.17,0,0,1,5.4,15c1.09,0,2.19,0,3.49,0l2.79-3.53L9.87,4.94l.28-.18L15.91,8l4.54-1.76L22,0l.32-.08,3.21,6,4.55.79L35,1.46A49.75,49.75,0,0,1,35,8.62l3.76,2.94,6.5-1.92.18.22L42,15.68l1.72,4.45,6.22,1.59L50,22l-6,3.2-.71,4.53,4.76,4.9c-2.32.45-4.52,0-6.78,0l-2.9,3.66c.49,2.17,1.5,4.26,1.71,6.93L34,42,29.6,43.73,28,50.09l-.27,0-3.17-6-4.61-.79L15.21,48ZM9.85,21.91c.35-.51.74-1,1.05-1.53A17,17,0,0,1,15.79,15c5.88-4,12.12-5.18,18.84-2.2.06,0,.16,0,.24-.06-1.44-1.67-5.4-3.5-8-3.75a15,15,0,0,0-13.55,5.36,12.94,12.94,0,0,0-3.44,7.56l0,0C9.82,22.07,9.84,22,9.85,21.91Z'
    )

  taiwanSvg = taiwanMap
    .select('g.countyText')
    .selectAll('.county')
    .append('text')
    .attr('class', 'levelBg')
    .attr('x', (d: any) => textPositionX(d))
    .attr('y', (d: any) => textPositionY(d))
    .text((d: any) => {
      const heatInjuryIndexArray = getCurrentData(d.properties['COUNTYNAME']).map((item: any) => {
        return item.HeatInjuryIndex
      })
      return Math.max(...heatInjuryIndexArray)
    })

  taiwanSvg = taiwanMap
    .select('g.countyText')
    .selectAll('.county')
    .append('text')
    .attr('class', 'levelText')
    .attr('x', (d: any) => textPositionX(d))
    .attr('y', (d: any) => textPositionY(d))
    .text((d: any) => {
      const heatInjuryIndexArray = getCurrentData(d.properties['COUNTYNAME']).map((item: any) => {
        return item.HeatInjuryIndex
      })
      return Math.max(...heatInjuryIndexArray)
    })

  taiwanSvg = taiwanMap
    .select('g.countyText')
    .selectAll('.county')
    .append('text')
    .attr('class', 'countyLabelBg')
    .attr('text-anchor', 'middle')
    .attr('x', (d: any) => textPositionX(d))
    .attr('y', (d: any) => textPositionY(d))
    .text((d: any) => d.properties['COUNTYNAME'])

  taiwanSvg = taiwanMap
    .select('g.countyText')
    .selectAll('.county')
    .append('text')
    .attr('class', 'countyLabel')
    .attr('text-anchor', 'middle')
    .attr('x', (d: any) => textPositionX(d))
    .attr('y', (d: any) => textPositionY(d))
    .text((d: any) => d.properties['COUNTYNAME'])

  //- 縣市文字 X 軸調整
  function textPositionX(d: any) {
    if (d.properties.COUNTYID == 'Q') {
      return pathGenerator.centroid(d)[0] + 30
    } else if (d.properties.COUNTYID == 'I') {
      return pathGenerator.centroid(d)[0] - 20
    } else if (d.properties.COUNTYID == 'A') {
      return pathGenerator.centroid(d)[0] - 10
    } else if (d.properties.COUNTYID == 'C') {
      return pathGenerator.centroid(d)[0] + 20
    } else if (d.properties.COUNTYID == 'J') {
      return pathGenerator.centroid(d)[0] + 13
    } else if (d.properties.COUNTYID == 'O') {
      return pathGenerator.centroid(d)[0] - 1
    } else if (d.properties.COUNTYID == 'H') {
      return pathGenerator.centroid(d)[0] - 10
    } else if (d.properties.COUNTYID == 'K') {
      return pathGenerator.centroid(d)[0] - 23
    } else if (d.properties.COUNTYID == 'B') {
      return pathGenerator.centroid(d)[0] - 50
    } else if (d.properties.COUNTYID == 'N') {
      return pathGenerator.centroid(d)[0] - 10
    } else if (d.properties.COUNTYID == 'P') {
      return pathGenerator.centroid(d)[0] - 25
    } else if (d.properties.COUNTYID == 'D') {
      return pathGenerator.centroid(d)[0] - 32
    } else if (d.properties.COUNTYID == 'E') {
      return pathGenerator.centroid(d)[0] - 55
    } else if (d.properties.COUNTYID == 'T') {
      return pathGenerator.centroid(d)[0] - 10
    } else if (d.properties.COUNTYID == 'V') {
      return pathGenerator.centroid(d)[0] + 25
    } else if (d.properties.COUNTYID == 'U') {
      return pathGenerator.centroid(d)[0] + 35
    } else if (d.properties.COUNTYID == 'G') {
      return pathGenerator.centroid(d)[0] + 30
    } else if (d.properties.COUNTYID == 'X') {
      return pathGenerator.centroid(d)[0] - 25
    } else if (d.properties.COUNTYID == 'W') {
      return pathGenerator.centroid(d)[0] + 20
    } else if (d.properties.COUNTYID == 'Z') {
      return pathGenerator.centroid(d)[0] + 25
    } else if (d.properties.COUNTYID == 'M') {
      return pathGenerator.centroid(d)[0]
    } else {
      return pathGenerator.centroid(d)[0] + 3
    }
  }

  //- 縣市文字 Y 軸調整
  function textPositionY(d: any) {
    if (d.properties.COUNTYID == 'W') {
      return pathGenerator.centroid(d)[1] + 42
    } else if (d.properties.COUNTYID == 'B') {
      return pathGenerator.centroid(d)[1] + 1
    } else if (d.properties.COUNTYID == 'E') {
      return pathGenerator.centroid(d)[1] + 65
    } else if (d.properties.COUNTYID == 'F') {
      return pathGenerator.centroid(d)[1] + 29
    } else if (d.properties.COUNTYID == 'A') {
      return pathGenerator.centroid(d)[1] - 10
    } else if (d.properties.COUNTYID == 'X') {
      return pathGenerator.centroid(d)[1] + 25
    } else if (d.properties.COUNTYID == 'I') {
      return pathGenerator.centroid(d)[1] + 20
    } else if (d.properties.COUNTYID == 'Q') {
      return pathGenerator.centroid(d)[1] + 18
    } else if (d.properties.COUNTYID == 'C') {
      return pathGenerator.centroid(d)[1] - 5
    } else if (d.properties.COUNTYID == 'G') {
      return pathGenerator.centroid(d)[1] + 18
    } else if (d.properties.COUNTYID == 'J') {
      return pathGenerator.centroid(d)[1] + 20
    } else if (d.properties.COUNTYID == 'O') {
      return pathGenerator.centroid(d)[1] - 3
    } else if (d.properties.COUNTYID == 'H') {
      return pathGenerator.centroid(d)[1] - 15
    } else if (d.properties.COUNTYID == 'K') {
      return pathGenerator.centroid(d)[1] - 5
    } else if (d.properties.COUNTYID == 'N') {
      return pathGenerator.centroid(d)[1] + 2
    } else if (d.properties.COUNTYID == 'P') {
      return pathGenerator.centroid(d)[1] + 10
    } else if (d.properties.COUNTYID == 'D') {
      return pathGenerator.centroid(d)[1] + 15
    } else if (d.properties.COUNTYID == 'T') {
      return pathGenerator.centroid(d)[1] + 45
    } else if (d.properties.COUNTYID == 'V') {
      return pathGenerator.centroid(d)[1] + 25
    } else if (d.properties.COUNTYID == 'Z') {
      return pathGenerator.centroid(d)[1] + 28
    } else if (d.properties.COUNTYID == 'M') {
      return pathGenerator.centroid(d)[1] + 19
    } else if (d.properties.COUNTYID == 'U') {
      return pathGenerator.centroid(d)[1] + 4
    } else {
      return pathGenerator.centroid(d)[1]
    }
  }
}

function cancelCounty() {
  //- 有 .selected 存在，就移除 .selected
  if (document.querySelectorAll('.selected')) {
    document.querySelectorAll('.selected').forEach((item) => {
      item.classList.remove('selected')
    })
  }
  selectedCountyCurrentData.value = null

  cityNameCn.value = '臺灣'
  cityNameEn.value = 'Taiwan'
  selectedCountState.value = null
}

//- 取得 當時段熱傷害預報資料
const recordTimeRange = ref<Object>({})
function getCurrentData(d3CountyName: any) {
  return weatherData.value
    .map((item: any | null) => {
      if (item.CountyName == d3CountyName) {
        return item.Location.map((item2: any) => {
          return item2.Time.map((item3: any) => {
            let townTimeDate = item3.IssueTime.split(' ')[0]
            let townTimeHour = item3.IssueTime.split(' ')[1].split(':')[0]
            //- 判斷要取得的時間段(3的倍數與否)
            const isThree = Number(`${time.hour}`) / 3
            let timeRange = Number.isInteger(isThree) ? (isThree + 1) * 3 : Math.ceil(isThree) * 3
            timeRange < 10 ? (timeRange = `0${timeRange}`) : timeRange
            let timeRangeEnd = Number(timeRange) + 3
            timeRangeEnd < 10 ? (timeRangeEnd = `0${timeRangeEnd}`) : timeRangeEnd
            if (Number(timeRange) <= 21) {
              //- 過濾出 今日資料
              if (
                Number(timeRange) == Number(townTimeHour) &&
                townTimeDate == `${time.year}-${time.month}-${time.date}`
              ) {
                recordTimeRange.value = {
                  date: `${time.year}/${time.month}/${time.date}`,
                  time: `${timeRange}:00 ~ ${timeRangeEnd}:00`
                }
                return {
                  CountyName: item.CountyName,
                  TownName: item2.TownName,
                  IssueTime: item3.IssueTime,
                  HeatInjuryIndex: item3.WeatherElements['HeatInjuryIndex'],
                  HeatInjuryWarning: item3.WeatherElements['HeatInjuryWarning']
                }
              }
            } else if (Number(timeRange) == 24) {
              //- 當時間為21點過後，資料須取需跨日 00:00:00
              timeRange = 0
              const crossDate =
                Number(time.date) < 9 ? `0${Number(time.date) + 1}` : `${Number(time.date) + 1}`
              const tomorrow = `${time.year}-${time.month}-${crossDate}`
              if (timeRange == Number(townTimeHour) && townTimeDate == tomorrow) {
                recordTimeRange.value = {
                  date: `${time.year}/${time.month}/${crossDate}`,
                  time: '00:00 ~ 03:00'
                }
                return {
                  CountyName: item.CountyName,
                  TownName: item2.TownName,
                  IssueTime: item3.IssueTime,
                  HeatInjuryIndex: item3.WeatherElements['HeatInjuryIndex'],
                  HeatInjuryWarning: item3.WeatherElements['HeatInjuryWarning']
                }
              }
            }
          }).filter((e: any) => e)[0]
        })
      }
    })
    .filter((e: any) => e)[0]
}
//- 熱傷害等級
function indexRangeLevel(d: any) {
  const heatInjuryIndexArray = getCurrentData(d.properties['COUNTYNAME']).map((item: Number) => {
    return item.HeatInjuryIndex
  })
  const maxIndex = Math.max(...heatInjuryIndexArray)
  const state = ref<String>('')
  if (maxIndex >= heatInjuryIndex.notice && maxIndex < heatInjuryIndex.alert) {
    state.value = 'notice'
  } else if (maxIndex >= heatInjuryIndex.alert && maxIndex < heatInjuryIndex.danger) {
    state.value = 'alert'
  } else if (maxIndex >= heatInjuryIndex.danger && maxIndex < heatInjuryIndex.exDanger) {
    state.value = 'danger'
  } else if (maxIndex >= heatInjuryIndex.exDanger) {
    state.value = 'exDanger'
  } else {
    state.value = 'default'
  }
  return `county county${d.properties['COUNTYENG'].split(' ').join('')} ${state.value}`
}

const openDetail = ref<Boolean>(false)
const cardWidth = computed(() => {
  if (selectedCountyCurrentData.value) {
    const length = selectedCountyCurrentData.value.length
    if (screenWidth.value <= 540) {
      return `calc(100vw - 26px)`
    } else if (screenWidth.value < 768 && screenWidth.value > 540) {
      return openDetail.value
        ? `calc(100% - 210px)`
        : `${Math.ceil(length / 3) * 150 + Math.floor(length / 3) * 5}px`
    } else if (screenWidth.value >= 768 && screenWidth.value <= 1024) {
      return '190px'
    } else {
      return openDetail.value
        ? `calc(100% - 210px)`
        : `${Math.ceil(length / 2) * 34 + Math.floor(length / 2) * 5 + 32 + 28.8 + 20}px`
    }
  } else {
    return `200px`
  }
})
const cardHeight = computed(() => {
  if (selectedCountyCurrentData.value) {
    const length = selectedCountyCurrentData.value.length
    if (screenWidth.value <= 480) {
      return openDetail.value ? 0 : `${4 * 34 + 3 * 5 + 12 + 19.19 + 40}px`
    } else if (screenWidth.value < 480 && screenWidth.value <= 900) {
      return openDetail.value ? 0 : `${3 * 34 + 2 * 5 + 12 + 19.19 + 40}px`
    } else if (screenWidth.value < 1300 && screenWidth.value > 900) {
      return openDetail.value
        ? `calc(100% - 210px)`
        : `${length * 34 + length * 5 + 32 + 28.8 + 12}px`
    } else if (screenWidth.value >= 1300) {
      return openDetail.value
        ? `calc(100% - 210px)`
        : `${Math.ceil(length / 2) * 34 + Math.floor(length / 2) * 5 + 32 + 28.8 + 20}px`
    }
  } else {
    return `${2 * 34 + 19.19 + 40}px`
  }
})

const legendArr = ref<Array<Object>>([
  { title: '基本安全', note: '適當補充水分' },
  { title: '注意', note: '積極補充水分' },
  { title: '警戒', note: '需要多休息' },
  { title: '危險', note: '停止劇烈運動' },
  { title: '高危險', note: '原則上停止運動' }
])

const wbgtArr = ref<Array<Object>>([
  { label: '基本安全', value: '基本安全' },
  { label: '注意', value: '注意' },
  { label: '警戒', value: '警戒' },
  { label: '危險', value: '危險' },
  { label: '高危險', value: '高危險' }
])
const selectWbgt = ref<String>(wbgtArr.value[0].label)

const userArr = ref<Array<Object>>([
  { label: '一般民眾', subLabel: '', value: '一般民眾' },
  { label: '孩童', subLabel: '0-14歲', value: '孩童' },
  { label: '長者', subLabel: '65歲以上', value: '長者' },
  { label: '戶外工作者', subLabel: '含農、漁民', value: '戶外工作者' },
  { label: '運動者', subLabel: '', value: '運動者' },
  { label: '慢性病者', subLabel: '', value: '慢性病者' }
])
const selectUser = ref<String>(userArr.value[0].label)

const recommendArr = ref<Array<Object>>([
  {
    user: '一般民眾',
    recommend: [
      {
        wbgt: '基本安全',
        msg: ['正常作息、保持涼爽，適時補充水分。']
      },
      {
        wbgt: '注意',
        msg: ['正常作息、保持涼爽，適時補充水分。', '穿著透氣排汗及寬鬆的衣物。']
      },
      {
        wbgt: '警戒',
        msg: [
          '適時補充水分。',
          '穿著透氣及寬鬆的衣物。',
          '盡量待在室內有空調或通風處，外出戴帽或撐傘，注意防曬。'
        ]
      },
      {
        wbgt: '危險',
        msg: [
          '隨時補充水分，待在室內有空調或通風處。',
          '避免非必要的戶外活動，如要外出時，走陰涼處，務必戴帽、撐傘並做好防曬。'
        ]
      },
      {
        wbgt: '高危險',
        msg: [
          '隨時補充水分。',
          '避免外出，待在室內有空調或通風處，如要外出時，走陰涼處，務必戴帽、撐傘並做好防曬。'
        ]
      }
    ]
  },
  {
    user: '孩童',
    recommend: [
      {
        wbgt: '基本安全',
        msg: ['正常作息、保持涼爽，適時補充水分。']
      },
      {
        wbgt: '注意',
        msg: [
          '適時補充水分。',
          '穿著透氣排汗及寬鬆的衣物。',
          '外出走陰涼處、注意防曬、減少長時間處在高溫環境。',
          '切勿獨留孩童於車內。'
        ]
      },
      {
        wbgt: '警戒',
        msg: [
          '隨時補充水分。',
          '減少非必要的戶外活動，盡量待在室內有空調或通風處。',
          '外出注意防曬、穿著寬鬆透氣衣物，並戴帽或撐傘。',
          '切勿獨留孩童於車內。'
        ]
      },
      {
        wbgt: '危險',
        msg: [
          '隨時補充水分。',
          '待在室內有空調或通風處。',
          '避免非必要的戶外活動，如要外出時，走陰涼處，務必戴帽、撐傘並做好防曬。',
          '切勿獨留孩童於車內，避免孩童單獨行動。'
        ]
      },
      {
        wbgt: '高危險',
        msg: [
          '隨時補充水分。',
          '應避免外出，待在室內有空調或通風處。',
          '切勿獨留孩童於車內，密切注意孩童行動。',
          '密切注意孩童身體狀況，如有不適，盡速尋求協助。'
        ]
      }
    ]
  },
  {
    user: '長者',
    recommend: [
      {
        wbgt: '基本安全',
        msg: ['正常作息、保持涼爽，適時補充水分。']
      },
      {
        wbgt: '注意',
        msg: [
          '適時補充水分。',
          '穿著透氣排汗及寬鬆的衣物。',
          '外出走陰涼處、注意防曬、減少長時間處在高溫環境。'
        ]
      },
      {
        wbgt: '警戒',
        msg: [
          '隨時補充水分。',
          '減少非必要的戶外活動，盡量待在室內有空調或通風處。',
          '外出注意防曬、穿著寬鬆透氣衣物，並戴帽或撐傘。'
        ]
      },
      {
        wbgt: '危險',
        msg: [
          '隨時補充水分。',
          '待在室內有空調或通風處。',
          '避免非必要的戶外活動，如要外出時，走陰涼處，務必戴帽、撐傘並做好防曬。'
        ]
      },
      {
        wbgt: '高危險',
        msg: [
          '隨時補充水分。',
          '應避免外出，待在室內有空調或通風處。',
          '密切注意身體狀況，如有不適，盡速尋求協助。'
        ]
      }
    ]
  },
  {
    user: '戶外工作者',
    recommend: [
      {
        wbgt: '基本安全',
        msg: [
          '正常作息、保持涼爽，適時補充水分。',
          '適時至陰涼處休息及降溫、減少長時間處在高溫曝曬。'
        ]
      },
      {
        wbgt: '注意',
        msg: [
          '適時至陰涼處休息及降溫、減少長時間處在高溫曝曬。',
          '少量多次補充水分，大量流汗時可喝加鹽的冷水，注意避免過量加鹽。',
          '做好防曬措施，穿著透氣衣服、戴防曬帽等。',
          '可運用風扇、簡易遮陽裝置等方式降低高溫暴露。'
        ]
      },
      {
        wbgt: '警戒',
        msg: [
          '請適當調整作業時間，適時至陰涼處休息及降溫、遠離高溫曝曬。',
          '少量多次補充水分，不要感到口渴時才喝水。大量流汗時可喝加鹽的冷水，注意避免過量加鹽。',
          '做好防曬措施，穿著淺色、透氣衣服、戴防曬帽等。',
          '可運用風扇、簡易遮陽裝置等方式降低高溫暴露。'
        ]
      },
      {
        wbgt: '危險',
        msg: [
          '盡量避免在本時段作業，並適當調整作業時間，定期至陰涼處休息及降溫、遠離高溫曝曬。',
          '少量多次補充水分，不要感到口渴時才喝水。大量流汗時可喝加鹽的冷水，注意避免過量加鹽。',
          '做好防曬措施，穿著淺色、透氣衣服、戴防曬帽等。',
          '風扇、水霧、簡易遮陽裝置等方式降低高溫暴露，如有不適，應停止作業。'
        ]
      },
      {
        wbgt: '高危險',
        msg: [
          '避免在本時段戶外工作，或將重體力作業調整至清晨或傍晚',
          '如有戶外作業必要，應確實加強防曬措施、增加使用降溫設備，加強緊急應變機制，適當調整作業時間，定期至陰涼處休息及降溫。',
          '少量多次補充水分，不要感到口渴時才喝水。大量流汗時可喝加鹽的冷水，注意避免過量加鹽。',
          '如有不適，應停止作業，至陰涼處休息，請求協助。'
        ]
      }
    ]
  },
  {
    user: '運動者',
    recommend: [
      {
        wbgt: '基本安全',
        msg: ['正常作息、保持涼爽，適時補充水分。', '運動每 30 分鐘進行一次休息。']
      },
      {
        wbgt: '注意',
        msg: [
          '至陰涼處及室內進行運動，避免長時間處在高溫環境。',
          '運動每 30 分鐘進行一次休息。',
          '少量多次補充水分，大量流汗時可喝加鹽的冷水，注意避免過量加鹽。',
          '穿著透氣、排汗及寬鬆衣物。'
        ]
      },
      {
        wbgt: '警戒',
        msg: [
          '建議停止戶外運動，進行室內運動時，每 30 分鐘進行一次休息。',
          '少量多次補充水分，大量流汗時可喝加鹽的冷水，注意避免過量加鹽。',
          '穿著透氣、排汗及寬鬆衣物。'
        ]
      },
      {
        wbgt: '危險',
        msg: [
          '建議停止戶外運動及劇烈運動，進行室內運動時，每 30 分鐘進行一次休息。',
          '少量多次補充水分，大量流汗時可喝加鹽的冷水，注意避免過量加鹽。',
          '穿著透氣、排汗及寬鬆衣物。'
        ]
      },
      {
        wbgt: '高危險',
        msg: [
          '停止戶外運動及劇烈運動，進行室內運動時，每 30 分鐘進行一次休息。',
          '少量多次補充水分，大量流汗時可喝加鹽的冷水，注意避免過量加鹽。',
          '穿著透氣、排汗及寬鬆衣物。'
        ]
      }
    ]
  },
  {
    user: '慢性病者',
    recommend: [
      {
        wbgt: '基本安全',
        msg: ['定期測量血壓及血糖，詢問醫師用藥及適當水分攝取，並定期回診追蹤。']
      },
      {
        wbgt: '注意',
        msg: [
          '定期測量血壓及血糖，詢問醫師用藥及適當水分攝取，並定期回診追蹤。',
          '穿著寬鬆、透氣衣物。',
          '外出時，宜走陰涼處，注意防曬，減少長時間處在高溫環境，注意室內外溫差。'
        ]
      },
      {
        wbgt: '警戒',
        msg: [
          '定期測量血壓及血糖，詢問醫師用藥及適當水分攝取，並定期回診追蹤。',
          '減少非必要的戶外活動，盡量待在室內有空調或通風處，注意室內外溫差。',
          '外出注意防曬，穿著寬鬆透氣衣物，戴遮陽帽或撐傘。'
        ]
      },
      {
        wbgt: '危險',
        msg: [
          '定期測量血壓及血糖，詢問醫師用藥及適當水分攝取，並定期回診追蹤。',
          '避免非必要的戶外活動，盡量待在室內有空調或通風處，注意室內外溫差。',
          '如必須外出，宜走陰涼處，務必戴遮陽帽或撐傘，並做好防曬。',
          '密切注意身體狀況，如有不適，應盡速尋求協助。'
        ]
      },
      {
        wbgt: '高危險',
        msg: [
          '定期測量血壓及血糖，詢問醫師用藥及適當水分攝取，並定期回診追蹤。',
          '應避免外出，待在室內有空調或通風處，注意室內外溫差大。',
          '密切注意身體狀況，如有不適，應盡速尋求協助。'
        ]
      }
    ]
  }
])

const recommendList = computed(() => {
  return recommendArr.value
    .map((item: any) => {
      if (item.user == selectUser.value) {
        return item.recommend
          .map((item2: any) => {
            if (item2.wbgt == selectWbgt.value) {
              return item2.msg
            }
          })
          .filter((e: any) => e)[0]
      }
    })
    .filter((e: any) => e)[0]
})

const exSelectTown = ref<String>(selectTown.value)

function clickTown(townName: String) {
  openDetail.value = true
  selectTown.value = townName

  countyData.value['Location'].forEach((item: any) => {
    if (selectTown.value == item.TownName) {
      townData.value = item['Time']
        .map((item2: any) => {
          return {
            IssueTime: new Date(item2.IssueTime.split(' ').join('T')).getTime(),
            WeatherElements: {
              HeatInjuryIndex: item2.WeatherElements.HeatInjuryIndex,
              HeatInjuryWarning: item2.WeatherElements.HeatInjuryWarning
            }
          }
        })
        .sort((a: any, b: any) => {
          return a['IssueTime'] - b['IssueTime']
        })
        .splice(0, 9)

      if (townData.value) {
        const townWbgt = townData.value[0]['WeatherElements']['HeatInjuryIndex']
        if (townWbgt >= heatInjuryIndex.notice && townWbgt < heatInjuryIndex.alert) {
          selectWbgt.value = wbgtArr.value[1].label
        } else if (townWbgt >= heatInjuryIndex.alert && townWbgt < heatInjuryIndex.danger) {
          selectWbgt.value = wbgtArr.value[2].label
        } else if (townWbgt >= heatInjuryIndex.danger && townWbgt < heatInjuryIndex.exDanger) {
          selectWbgt.value = wbgtArr.value[3].label
        } else if (townWbgt >= heatInjuryIndex.exDanger) {
          selectWbgt.value = wbgtArr.value[4].label
        } else {
          selectWbgt.value = wbgtArr.value[0].label
        }
      }
    }
  })

  const dayChart = d3.select('#dayChart')
  let chartSvg, gradient, area, line

  drawDayChart()
  function drawDayChart() {
    const margin = {
      top: 20,
      bottom: 50,
      left: 5,
      right: 60
    }

    const chartWidth = 400
    const chartHeight = 300

    //- 定義 X 座標 數值
    const x = d3
      .scaleTime()
      .domain([townData.value[0].IssueTime, townData.value[0].IssueTime + 24 * 60 * 60 * 1000])
      .range([margin.left, chartWidth])

    //- 定義 Y 座標 數值
    const y = d3
      .scaleLinear()
      .domain([0, 55])
      .range([chartHeight - margin.bottom, 0 + margin.top])

    chartSvg = dayChart
      .select('svg')
      .attr('width', chartWidth + margin.right)
      .attr('height', chartHeight)
      .attr('viewBox', [0, 0, chartWidth, chartHeight])
      .attr('style', 'max-width: 100%; height: auto;')

    //- 新增漸層圖層
    gradient = chartSvg
      .append('defs')
      .append('linearGradient')
      .attr('id', 'svgGradient')
      .attr('x1', '50%')
      .attr('x2', '50%')
      .attr('y1', '0%')
      .attr('y2', '100%')

    //- 漸層圖層起點位置與顏色
    gradient
      .append('stop')
      .attr('class', 'start')
      .attr('offset', '0%')
      .attr('stop-color', 'var(--chartArea)')
      .attr('stop-opacity', 1)

    //- 漸層圖層終點位置與顏色
    gradient
      .append('stop')
      .attr('class', 'end')
      .attr('offset', '90%')
      .attr('stop-color', '#EEE')
      .attr('stop-opacity', 1)

    //- area 生成區塊
    area = d3
      .area()
      .x((d: any) => x(d.IssueTime))
      .y0(chartHeight - margin.bottom)
      .y1((d: any) => y(d.WeatherElements.HeatInjuryIndex))
    //- .curve(d3.curveBasis)

    chartSvg
      .append('g')
      .attr('class', 'area')
      .append('path')
      .attr('d', area(townData.value))
      .attr('fill', 'url(#svgGradient)')

    //- 動畫
    chartSvg
      .selectAll('.area')
      .append('rect')
      .attr('class', 'mask')
      .attr('width', chartWidth + margin.right)
      .attr('height', chartHeight + margin.top + margin.bottom)
      .attr('fill', '#F1F1F1')
      .attr('y', 0)
      .transition()
      .duration(2000)
      .delay(100)
      .ease(d3['easeQuadInOut'])
      .attr('y', chartHeight)

    //- line 生成區塊
    line = d3
      .line()
      .x((d: any) => x(d.IssueTime))
      .y((d: any) => y(d.WeatherElements.HeatInjuryIndex))
    //- .curve(d3.curveBasis)

    chartSvg
      .append('g')
      .attr('class', 'main-line')
      .append('path')
      .datum(townData.value)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke-width', 2)
      .attr('stroke', 'var(--chart)')

    //- 動畫
    chartSvg
      .selectAll('.main-line')
      .append('rect')
      .attr('class', 'mask')
      .attr('width', chartWidth + margin.right)
      .attr('height', chartHeight + margin.top + margin.bottom)
      .attr('fill', '#F1F1F1')
      .attr('x', 0)
      .transition()
      .duration(1000)
      .delay(600)
      .ease(d3['easeQuadInOut'])
      .attr('x', chartWidth + margin.right + margin.left)

    //- 定義 圓形標示
    chartSvg
      .selectAll('circle')
      .data(townData.value)
      .enter()
      .append('g')
      .attr('class', 'dot')
      .append('circle')
      .attr('r', 5)
      .attr('stroke', 'var(--chart)')
      .attr('stroke-width', 2)
      .attr('fill', '#FFF')
      .attr('cx', (d: any) => x(d.IssueTime))
      .attr('cy', (d: any) => y(d.WeatherElements.HeatInjuryIndex))

    //- 熱傷害數值
    chartSvg
      .selectAll('.dot')
      //- .data(townData.value)
      .append('text')
      .attr('x', (d: any) => x(d.IssueTime))
      .attr('y', (d: any) => y(d.WeatherElements.HeatInjuryIndex) - 12)
      .attr('text-anchor', 'middle')
      .attr('class', 'chartNum')
      .text((d: any) => d.WeatherElements.HeatInjuryIndex)

    //- 動畫
    chartSvg
      .selectAll('.dot')
      .attr('style', 'opacity:0')
      .transition()
      .duration(1000)
      //- .delay((d, i) => i * 125)
      .ease(d3['easeLinear'])
      .attr('style', 'opacity:1')

    //- X軸文字
    chartSvg
      .append('g')
      .attr('class', 'xAxis chartNum')
      .attr('transform', `translate(0, ${chartHeight - margin.bottom})`)
      .call(
        d3
          .axisBottom(x)
          .tickFormat((d: any) => {
            if (new Date(d).getHours() == 0)
              return `${new Date(d).getMonth() + 1}/${new Date(d).getDate()}`
            else return `${new Date(d).getHours()}時`
          })
          .ticks(8)
          .tickPadding(15)
          .tickSizeOuter(0)
      )
      .call((g: any) => g.attr('stroke-opacity', 0.25))

    //- Y軸文字
    chartSvg
      .append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      //- .attr('style', 'opacity: 0')
      .call(d3.axisLeft(y).ticks(10).tickSizeInner(0).tickPadding(20))
      .call((g: any) => g.select('.domain').remove())
      .call((g: any) =>
        g
          .selectAll('.tick line')
          .clone()
          .attr('x2', chartWidth - margin.left)
          .attr('stroke-opacity', 0.1)
      )

    //- 中文警告標示圓底
    chartSvg
      .selectAll('#dayChart')
      .data(townData.value)
      .enter()
      .append('g')
      .attr('class', (d: any) => {
        const indexNum = d.WeatherElements.HeatInjuryIndex
        if (indexNum >= heatInjuryIndex.notice && indexNum < heatInjuryIndex.alert) {
          return 'warning notice'
        } else if (indexNum >= heatInjuryIndex.alert && indexNum < heatInjuryIndex.danger) {
          return 'warning alert'
        } else if (indexNum >= heatInjuryIndex.danger && indexNum < heatInjuryIndex.exDanger) {
          return 'warning danger'
        } else if (indexNum >= heatInjuryIndex.exDanger) {
          return 'warning exDanger'
        } else {
          return 'warning empty'
        }
      })
      .append('circle')
      .attr('r', 15)
      .attr('cx', (d: any) => x(d.IssueTime))
      .attr('cy', chartHeight - margin.bottom - 6)

    //- 中文警告標示文字
    chartSvg
      .selectAll('g.warning')
      .append('text')
      .attr('class', 'warnTextStroke')
      .attr('x', (d: any) => x(d.IssueTime))
      .attr('y', () => chartHeight - margin.bottom)
      .attr('text-anchor', 'middle')
      .attr('fill', '#F1F1F1')
      .text((d: any) => {
        const indexNum = d.WeatherElements.HeatInjuryIndex
        if (indexNum >= heatInjuryIndex.notice && indexNum < heatInjuryIndex.alert) {
          return '注'
        } else if (indexNum >= heatInjuryIndex.alert && indexNum < heatInjuryIndex.danger) {
          return '警'
        } else if (indexNum >= heatInjuryIndex.danger && indexNum < heatInjuryIndex.exDanger) {
          return '危'
        } else if (indexNum >= heatInjuryIndex.exDanger) {
          return '高'
        } else {
          return ''
        }
      })

    chartSvg
      .selectAll('g.warning')
      .append('text')
      .attr('class', 'warnText')
      .attr('x', (d: any) => x(d.IssueTime))
      .attr('y', () => chartHeight - margin.bottom)
      .attr('text-anchor', 'middle')
      .attr('fill', '#F1F1F1')
      .text((d: any) => {
        const indexNum = d.WeatherElements.HeatInjuryIndex
        if (indexNum >= heatInjuryIndex.notice && indexNum < heatInjuryIndex.alert) {
          return '注'
        } else if (indexNum >= heatInjuryIndex.alert && indexNum < heatInjuryIndex.danger) {
          return '警'
        } else if (indexNum >= heatInjuryIndex.danger && indexNum < heatInjuryIndex.exDanger) {
          return '危'
        } else if (indexNum >= heatInjuryIndex.exDanger) {
          return '高'
        } else {
          return ''
        }
      })

    //- 動畫
    chartSvg
      .selectAll('.warning')
      .attr('style', 'opacity:0')
      .transition()
      .duration(1000)
      .delay(1200)
      .ease(d3['easeQuadInOut'])
      .attr('style', 'opacity:1')
  }

  if (exSelectTown.value !== '') {
    if (exSelectTown.value !== selectTown.value) {
      // 清除 svg
      chartSvg = chartSvg.remove()
      // 重新宣告
      chartSvg = dayChart.append('svg')
      drawDayChart()
    } else {
      return
    }
  } else {
    exSelectTown.value = townName
  }
}
</script>

<template lang="pug">
.webTitle(:class="{ show: showDefine }")
  p.showTime
    span 未來三小時
    i.fontNum {{ recordTimeRange.time }}
  h1
    span 熱傷害指數
    FontAwesomeIcon(icon="circle-question" :class="{ show: showDefine }" @click="showDefine = !showDefine" )
  h3 Wet-Bulb Globe Temperature
  .explain(:class="{ show: showDefine }")
    p
      span 同時考慮
      span.highlight 溫度、相對濕度、太陽幅射及風速
      span 的綜合指數，簡稱 
      span.highlight WBGT
      span 。
    p 
      span 是一種與人體健康效應直接相關的
      span.highlight 熱壓力指標
      span 。

//- 地圖
#taiwanMap
  svg

//- 點選的城市中 / 英文名
.info
  h1
    span {{ cityNameCn }}
    span.state(:class="{ default: selectedCountState == legendArr[0].title, notice: selectedCountState == legendArr[1].title, alert: selectedCountState == legendArr[2].title, danger: selectedCountState == legendArr[3].title, exDanger: selectedCountState == legendArr[4].title}") {{ selectedCountState }}
  h2 {{ cityNameEn }}
//- 圖例
.legend
  ul
    li(v-for="item in legendArr")
      .title
        FontAwesomeIcon(icon="circle")
        span {{ item.title }}
      .note
        span {{ item.note }}
//- 城市下的鄉鎮資料
.card(:style="{ height: cardHeight }" :class='{ hide: openDetail, hintBox: !selectedCountyCurrentData, countyBox: selectedCountyCurrentData }')
  .hint(v-if="!selectedCountyCurrentData")
    b
      FontAwesomeIcon(icon="circle-exclamation")
      span 小提示
    p 點擊地圖查看縣市熱傷害指數詳情
  .content(v-else)
    .title
      .selectedCounty
        b
          FontAwesomeIcon(icon="circle-exclamation")
          span 請點擊鄉鎮名稱
      .function 
        FontAwesomeIcon.close(icon="xmark" @click="cancelCounty()")
    ul(:style="{ width: cardWidth }")
      li(
        v-for="item in selectedCountyCurrentData"
        :class="{ notice: item.HeatInjuryIndex >= heatInjuryIndex.notice && item.HeatInjuryIndex < heatInjuryIndex.alert, alert: item.HeatInjuryIndex >= heatInjuryIndex.alert && item.HeatInjuryIndex < heatInjuryIndex.danger, danger: item.HeatInjuryIndex >= heatInjuryIndex.danger && item.HeatInjuryIndex < heatInjuryIndex.exDanger, exDanger: item.HeatInjuryIndex >= heatInjuryIndex.exDanger, selected: selectTown == item.TownName }"
        :title="item.HeatInjuryWarning"
        @click="clickTown(item.TownName)"
      )
        span {{ item.TownName }}
        span.index.fontNum {{ item.HeatInjuryIndex }}

.chart(:class="{ hide: !openDetail }")
  .report(:class="{ hide: !openDetail }")
    FontAwesomeIcon(icon="xmark" class="close" :class="{ show: openDetail }" @click="openDetail = false; selectTown = ''")
    .function
      .title 
        h6 熱指數日報
      .selectBar
        .selectItem
          VueSelect.townSelect(
            v-model="selectTown"
            :options="townSelectArr"
            placeholder="請選擇城鎮區"
            :isClearable="false"
            @option-selected="clickTown(selectTown)"
          )
            template(#no-options) 查無您輸入的鄉鎮區
        .selectItem
          VueSelect.townSelect(
            v-model="selectUser"
            :options="userArr"
            placeholder="民眾類別"
            :isClearable="false"
            :isSearchable="false"
          )
            template(#option="{ option }")
              p.customOption
                span {{ option.label }}
                small {{ option.subLabel }}
        .selectItem
          VueSelect.townSelect(
            v-model="selectWbgt"
            :options="wbgtArr"
            placeholder="熱傷害指數階級"
            :isClearable="false"
            :isSearchable="false"
          )
    #dayChart
      svg
  .recommendation(v-if="townData" :class="{ hide: !openDetail }")
    h6 如何預防熱傷害
    ul.recommend(v-if="townData && selectWbgt && selectUser")
      li(v-for="item in recommendList") 
        FontAwesomeIcon(icon="hashtag")
        span {{ item }}
</template>

<style lang="sass" scoped></style>
