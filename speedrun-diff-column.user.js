// ==UserScript==
// @name        Speedrun.com - Time difference column
// @version     1.0
// @description Add time difference column on speedrun.com.
// @license     GPL-3.0-or-later
// @author      VacuityBox
// @namespace   UserScripts
// @updateURL   https://raw.githubusercontent.com/VacuityBox/UserScripts/main/speedrun-diff-column.user.js
// @downloadURL https://raw.githubusercontent.com/VacuityBox/UserScripts/main/speedrun-diff-column.user.js
// @run-at      document-idle
// @grant       none
// @include     https://www.speedrun.com/*
// ==/UserScript==

(() => {

"use strict"

const HOUR_TO_MS = 3600 * 1000
const MINUTE_TO_MS = 60 * 1000
const SECOND_TO_MS = 1000

function getLeaderBoard() {
  let leaderBoard = null

  const lbdiv = document.getElementById("leaderboarddiv")
  if (lbdiv) {
    // Find table.
    for (const child of lbdiv.children) {
      if (child.tagName === "TABLE") {
        // Get body.
        if (child.children.length > 0) {
          const tbody = Array.from(child.children[0].rows)
          leaderBoard = {
            tableHeader: tbody[0],
            tableData: tbody.slice(1)
          }
          break
        }
      }
    }
  }

  return leaderBoard
}

function parseSpeedrunTime(str) {
  let result = 0 // in milliseconds.
  let tmp = 0

  if (str.length < 1) {
    return null
  }

  // To make convertion easier.
  if (str.lastIndexOf("ms") !== -1) {
    str = str.replace("ms", "x")
  }

  for (const c of str) {
    switch (c) {
      // Whitespace.
      case ' ':
        break

      // Digit.
      case '0': case '1': case '2': case '3': case '4':
      case '5': case '6': case '7': case '8': case '9':
        tmp *= 10
        tmp += c - '0'
        break

      // Time unit character.
      case 'h':
        result += tmp * HOUR_TO_MS
        tmp = 0
        break
      case 'm':
        result += tmp * MINUTE_TO_MS
        tmp = 0
        break
      case 's':
        result += tmp * SECOND_TO_MS
        tmp = 0
        break
      case 'x':
        result += tmp
        tmp = 0
        break

      // Unknown character.
      default:
        return null
    }
  }

  return result
}

function speedrunTimeToString(time, showMilliseconds) {
  const milliseconds = time % 1000
  time = Math.floor(time / 1000)

  const seconds = (time % 60)
  time = Math.floor(time / 60)

  const minutes = time % 60
  time = Math.floor(time / 60)

  const hours = time

  return hours + "h " +
    minutes.toString().padStart(2, '0') + "m " +
    seconds.toString().padStart(2, '0') + "s " +
    (showMilliseconds ? milliseconds.toString().padStart(3, '0') + "ms" : "")
}

function getTimesColumnIndex(leaderBoard) {
  let index = null
  let max = 0

  // Pick column that has "time" in name and has most times.
  for (const header of leaderBoard.tableHeader.cells) {
    if (header.textContent.toLowerCase().includes("time")) {
      // Count number of times.
      let count = 0
      for (const row of leaderBoard.tableData) {
        if (row.cells[header.cellIndex].textContent.length > 0) {
          count += 1
        }
      }

      if (count > max) {
        max = count
        index = header.cellIndex
      }
    }
  }

  return index
}

function getSpeedrunTime(row, timesColumnIndex) {
  const timeObject = row.cells[timesColumnIndex]
  return parseSpeedrunTime(timeObject.textContent)
}

function getLoggedUserName() {
  let userName = null

  const un = document.getElementById("navbar-username")
  if (un) {
    const collection = un.getElementsByClassName("username")
    if (collection.length > 0) {
      userName = collection[0].textContent
    }
  }

  return userName
}

function getUserPBRowIndex(leaderBoard, userName) {
  let rowIndex = null
  let playerColumnIndex = null

  // Get player column index.
  for (const header of leaderBoard.tableHeader.cells) {
    if (header.textContent === "Player") {
      playerColumnIndex = header.cellIndex
      break
    }
  }

  // Find player PB row index.
  if (playerColumnIndex) {
    for (const [i, row] of leaderBoard.tableData.entries()) {
      const column = row.cells[playerColumnIndex]
      if (column.textContent === userName) {
        rowIndex = i
        break
      }
    }
  }

  return rowIndex
}

function updateTimes(leaderBoard, timesColumnIndex, currentRow, showMilliseconds) {
  const diffColumnIndex = timesColumnIndex + 1

  // Add diff times.
  const comparsionTime = getSpeedrunTime(currentRow, timesColumnIndex)
  for (const row of leaderBoard.tableData) {
    const column = row.cells[diffColumnIndex]

    // Row we are comparing aginst.
    if (row === currentRow) {
      column.style.color = "gold"
      column.textContent = "-/+"
      continue
    }

    const diff = getSpeedrunTime(row, timesColumnIndex) - comparsionTime
    if (diff >= 0) {
      column.style.color = "red"
      column.textContent = "+" + speedrunTimeToString(diff, showMilliseconds)
    } else {
      column.style.color = "green"
      column.textContent = "-" + speedrunTimeToString(Math.abs(diff), showMilliseconds)
    }
  }

  // console.log("Diff column updated")
}

function reset() {
  const leaderBoard = getLeaderBoard()
  if (leaderBoard == null) {
    return false
  }

  const timesColumnIndex = getTimesColumnIndex(leaderBoard)
  if (timesColumnIndex == null) {
    return false
  }

  const diffColumnIndex = timesColumnIndex + 1

  // Find if any time has millisecond.
  const showMilliseconds = ((lb, col) => {
    for (const row of lb.tableData) {
      if (row.cells[col].textContent.lastIndexOf("ms") > -1) {
        return true
      }
    }
    return false
  })(leaderBoard, timesColumnIndex)

  // Add column header.
  const diffHeader = leaderBoard.tableHeader.insertCell(diffColumnIndex)
  diffHeader.textContent = "Difference"
  diffHeader.style.fontWeight = "Bold"
  diffHeader.style.color = "rgba(255,255,255,0.7)"

  // Add column and event handler.
  for (const row of leaderBoard.tableData) {
    // Insert column.
    row.insertCell(diffColumnIndex)

    // Register event handler.
    const createOnMouseOverHandler = (lb, index, r, ms) => {
      return () => updateTimes(lb, index, r, ms)
    }

    row.onmouseover =
      createOnMouseOverHandler(leaderBoard, timesColumnIndex, row, showMilliseconds)
  }

  // Init time diff column to show difference to:
  // - PB (if logged and you have time)
  // - 1st time
  let initTimeIndex = 0
  const userName = getLoggedUserName()
  if (userName) {
    const pbRowIndex = getUserPBRowIndex(leaderBoard, userName)
    if (pbRowIndex) {
      initTimeIndex = pbRowIndex
    }
  }

  const currentRow = leaderBoard.tableData[initTimeIndex]
  updateTimes(leaderBoard, timesColumnIndex, currentRow, showMilliseconds)

  return true
}

function addObserver() {
  const callback = (mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === "childList") {
        if (mutation.target.id === "leaderboarddiv" && mutation.addedNodes.length > 0) {
          reset()
        }
      }
    }
  }

  const observer = new MutationObserver(callback)

  // Start observing.
  const config = { attributes: false, childList: true, subtree: true }
  const lbform = document.getElementById("leaderboardform")
  observer.observe(lbform, config)
}

function init() {
  addObserver()
}

// Run script.
init()

})()
