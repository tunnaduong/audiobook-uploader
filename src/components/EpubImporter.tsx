import { useState } from 'react'
import type { EpubMetadata } from '../types'
import './EpubImporter.css'

interface EpubImporterProps {
  onEpubLoaded: (metadata: EpubMetadata) => void
  onClose: () => void
}

export function EpubImporter({ onEpubLoaded, onClose }: EpubImporterProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)

  const handleSelectFile = async () => {
    try {
      setError(null)
      const filters = [
        { name: 'EPUB Books', extensions: ['epub'] },
        { name: 'All Files', extensions: ['*'] },
      ]

      const filePath = await window.api?.selectFile?.(filters)
      if (!filePath) return

      setSelectedFile(filePath)
      setIsLoading(true)

      // Parse EPUB file
      const result = await window.api?.parseEpubFile?.(filePath)

      if (!result?.success || !result.data) {
        setError(result?.error || 'Không thể phân tích tệp EPUB')
        setSelectedFile(null)
        return
      }

      // Successfully parsed
      onEpubLoaded(result.data)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi không xác định'
      setError(`Lỗi tải EPUB: ${errorMsg}`)
      setSelectedFile(null)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="epub-importer">
      <div className="epub-importer-header">
        <h3>📖 Nhập Tệp EPUB</h3>
        <button className="close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="epub-importer-content">
        {error && <div className="epub-error">{error}</div>}

        <div className="epub-file-selector">
          <button
            className="btn-select-file"
            onClick={handleSelectFile}
            disabled={isLoading}
          >
            {isLoading ? '⏳ Đang Tải...' : selectedFile ? '✓ Tệp Đã Chọn' : '📁 Chọn Tệp EPUB'}
          </button>

          {selectedFile && (
            <div className="selected-file-info">
              <small>Đã chọn: {selectedFile.split('\\').pop()}</small>
            </div>
          )}
        </div>

        <div className="epub-instructions">
          <p>Chọn một tệp EPUB để xem tất cả các chương và chọn những chương nào bạn muốn chuyển đổi thành audiobook.</p>
        </div>
      </div>

      <div className="epub-importer-footer">
        <button className="btn-secondary" onClick={onClose}>
          Hủy
        </button>
      </div>
    </div>
  )
}
