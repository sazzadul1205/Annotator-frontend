import { useState } from 'react'
import { X, Upload, FileText, AlertCircle, CheckCircle, Info } from 'lucide-react'

const FileUploadModal = ({ isOpen, onClose, onUpload, isLoading }) => {
  const [selectedFile, setSelectedFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const validTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]

  const maxSize = 50 * 1024 * 1024 // 50MB

  const handleFileSelect = (file) => {
    setError('')
    
    if (!file) {
      setError('No file selected')
      return
    }

    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a CSV or Excel file.')
      setSelectedFile(null)
      return
    }

    if (file.size > maxSize) {
      setError(`File size exceeds ${maxSize / (1024 * 1024)}MB limit.`)
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    handleFileSelect(file)
  }

  const handleFileInput = (e) => {
    const file = e.target.files[0]
    handleFileSelect(file)
  }

  const handleUpload = () => {
    if (!selectedFile) {
      setError('Please select a file first')
      return
    }
    onUpload(selectedFile)
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center rounded-t-xl">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg shrink-0">
              <Upload className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Upload File</h2>
              <p className="text-xs sm:text-sm text-gray-500 truncate">Import comments from CSV or Excel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
            disabled={isLoading}
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6">
          {/* File Requirements */}
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-blue-900">File Requirements</h4>
                <ul className="mt-1 text-xs sm:text-sm text-blue-800 space-y-1">
                  <li className="flex items-center gap-1.5">
                    <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                    <span className="truncate">Supported formats: <strong>.csv, .xls, .xlsx</strong></span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                    <span>Max file size: <strong>50 MB</strong></span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                    <span className="truncate">Expected columns: <strong>externalId, text</strong></span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                    <span className="truncate">Text column should contain the comment content</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Drag & Drop Area */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-colors ${
              dragOver
                ? 'border-blue-500 bg-blue-50'
                : selectedFile
                ? 'border-green-500 bg-green-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".csv,.xls,.xlsx"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isLoading}
            />

            {selectedFile ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <p className="font-medium text-gray-900 text-sm sm:text-base break-all">{selectedFile.name}</p>
                <p className="text-xs sm:text-sm text-gray-500">
                  {formatFileSize(selectedFile.size)}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedFile(null)
                    setError('')
                  }}
                  className="text-xs sm:text-sm text-red-600 hover:text-red-700"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 sm:w-10 sm:h-10 mx-auto text-gray-400" />
                <p className="text-sm sm:text-base text-gray-600">
                  Drag & drop your file here, or <span className="text-blue-600 font-medium">browse</span>
                </p>
                <p className="text-xs text-gray-400">
                  CSV, XLS, or XLSX files up to 50MB
                </p>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-2.5 sm:p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-start gap-2 text-sm">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Example Format */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200 overflow-x-auto">
            <p className="text-xs font-medium text-gray-700 mb-2">Expected file format:</p>
            <div className="font-mono text-xs text-gray-600 bg-white p-2 rounded border border-gray-200">
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <div>
                  <span className="font-semibold text-blue-600">externalId</span>
                  <span className="text-gray-300 mx-1">|</span>
                  <span className="font-semibold text-blue-600">text</span>
                </div>
                <div className="text-gray-400 text-right sm:text-left">(optional) (required)</div>
              </div>
              <div className="text-gray-600 mt-1">
                <div className="truncate">1 | "This is a sample comment"</div>
                <div className="truncate">2 | "Another comment example"</div>
                <div className="text-gray-400">... | ...</div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 sm:mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm sm:text-base disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || isLoading}
              className="w-full sm:flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium text-sm sm:text-base"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Upload File
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FileUploadModal