import { useState, useMemo } from 'react'
import type { EpubMetadata } from '../types'
import { formatEstimatedDuration, formatChapterRanges } from '../utils/epub-utils'
import './ChapterSelector.css'

interface ChapterSelectorProps {
  metadata: EpubMetadata
  onConfirm: (selectedChapters: number[]) => void
  onClose: () => void
}

export function ChapterSelector({ metadata, onConfirm, onClose }: ChapterSelectorProps) {
  const [selectedChapters, setSelectedChapters] = useState<Set<number>>(
    new Set(metadata.chapters.map(ch => ch.number))
  )

  // Calculate total word count and characters for selected chapters
  const stats = useMemo(() => {
    let totalWords = 0
    let totalCharacters = 0
    const selectedTitles: string[] = []

    metadata.chapters.forEach((chapter) => {
      if (selectedChapters.has(chapter.number)) {
        totalWords += chapter.wordCount
        // Estimate characters (~6 characters per word for Vietnamese)
        totalCharacters += chapter.wordCount * 6
        selectedTitles.push(chapter.title)
      }
    })

    const sortedNums = Array.from(selectedChapters).sort((a: number, b: number) => a - b)

    return {
      count: selectedChapters.size,
      totalWords,
      totalCharacters,
      duration: formatEstimatedDuration(totalWords),
      range: formatChapterRanges(sortedNums),
      selectedTitles,
    }
  }, [selectedChapters, metadata.chapters])

  const toggleChapter = (chapterNumber: number) => {
    const newSelected = new Set(selectedChapters)
    if (newSelected.has(chapterNumber)) {
      newSelected.delete(chapterNumber)
    } else {
      newSelected.add(chapterNumber)
    }
    setSelectedChapters(newSelected)
  }

  const selectAll = () => {
    setSelectedChapters(new Set(metadata.chapters.map(ch => ch.number)))
  }

  const deselectAll = () => {
    setSelectedChapters(new Set())
  }

  const handleConfirm = () => {
    if (selectedChapters.size === 0) {
      alert('Vui lòng chọn ít nhất một chương')
      return
    }
    const chapterArray = Array.from(selectedChapters).sort((a, b) => a - b)
    onConfirm(chapterArray)
  }

  return (
    <div className="chapter-selector">
      <div className="chapter-selector-header">
        <h3>📚 Chọn Chương</h3>
        <button className="close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="chapter-selector-content">
        {/* Book Info */}
        <div className="book-info">
          <div className="book-title">
            <strong>{metadata.title}</strong>
            {metadata.author && <span className="book-author">by {metadata.author}</span>}
          </div>
          <div className="book-stats">
            Tổng: {metadata.chapters.length} chương
          </div>
        </div>

        {/* Select All / Deselect All */}
        <div className="chapter-controls">
          <button className="btn-control" onClick={selectAll}>
            ✓ Chọn Tất Cả
          </button>
          <button className="btn-control" onClick={deselectAll}>
            ✗ Bỏ Chọn Tất Cả
          </button>
        </div>

        {/* Chapters List */}
        <div className="chapters-list">
          {metadata.chapters.map((chapter) => (
            <div
              key={chapter.id}
              className={`chapter-item ${selectedChapters.has(chapter.number) ? 'selected' : ''}`}
              onClick={() => toggleChapter(chapter.number)}
            >
              <input
                type="checkbox"
                checked={selectedChapters.has(chapter.number)}
                onChange={(e) => {
                  e.stopPropagation()
                  toggleChapter(chapter.number)
                }}
                className="chapter-checkbox"
              />
              <div className="chapter-details">
                <div className="chapter-number-title">
                  <strong>Chương {chapter.number}</strong>
                  <span className="chapter-title">{chapter.title}</span>
                </div>
                <div className="chapter-info">
                  <small>{chapter.wordCount} từ (~{Math.ceil(chapter.wordCount / 250)} phút)</small>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="selection-summary">
          <div className="summary-stat">
            <strong>Đã chọn: </strong>
            {stats.count} chương
          </div>
          <div className="summary-stat">
            <strong>Khoảng: </strong>
            {stats.range || 'Không'}
          </div>
          <div className="summary-stat">
            <strong>Tổng Từ: </strong>
            {stats.totalWords.toLocaleString('vi-VN')}
          </div>
          <div className="summary-stat">
            <strong>Tổng Ký Tự: </strong>
            {stats.totalCharacters.toLocaleString('vi-VN')}
          </div>
          <div className="summary-stat estimated-duration">
            <strong>⏱️ Thời Lượng Dự Kiến:</strong>
            {stats.duration}
          </div>
        </div>
      </div>

      <div className="chapter-selector-footer">
        <button className="btn-secondary" onClick={onClose}>
          Hủy
        </button>
        <button
          className="btn-primary"
          onClick={handleConfirm}
          disabled={selectedChapters.size === 0}
        >
          Tạo Audiobook ({selectedChapters.size} chương)
        </button>
      </div>
    </div>
  )
}
