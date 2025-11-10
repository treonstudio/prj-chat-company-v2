"use client"

import packageJson from "../../package.json"
import buildInfo from "../build-info.json"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-2 text-xs text-gray-400 sm:flex-row">
          <div className="flex items-center gap-2">
            <span>
              &copy; {currentYear} BC Chat{" "}
              . All rights reserved.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span>Version {packageJson.version}</span>
            <span className="text-gray-300">•</span>
            <span title={`Build time: ${buildInfo.buildTime}`}>
              {buildInfo.commitHash}
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
