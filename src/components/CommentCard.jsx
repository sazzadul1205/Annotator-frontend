import { useState } from 'react'
import {
  CheckCircle,
  Clock,
  User,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

function CommentCard({ comment, canValidate, onValidate }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [validationData, setValidationData] = useState({
    language: '',
    sentiment: '',
  })

  const handleValidate = () => {
    if (!validationData.language || !validationData.sentiment) {
      alert('Please select both language and sentiment')
      return
    }
    setIsValidating(true)
    onValidate(comment._id, validationData)
    setIsValidating(false)
  }

  const getSentimentColor = (sentiment) => {
    const colors = {
      Positive: 'text-green-600 bg-green-50',
      Negative: 'text-red-600 bg-red-50',
      Neutral: 'text-gray-600 bg-gray-50',
    }
    return colors[sentiment] || 'text-gray-600 bg-gray-50'
  }

  const getLanguageEmoji = (language) => {
    const emojis = {
      Bangla: '🇧🇩',
      English: '🇬🇧',
      Banglish: '🔤',
      Emoji: '😊',
      Other: '🌐',
    }
    return emojis[language] || '🌐'
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 transition">
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-gray-800 whitespace-pre-wrap break-words">
              {comment.text}
            </p>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-gray-600 transition flex-shrink-0"
            >
              {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>

          {/* Validation Status */}
          {comment.isValidated ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle size={14} />
                Validated
              </span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${getSentimentColor(comment.sentiment)}`}>
                {comment.sentiment}
              </span>
              <span className="flex items-center gap-1 text-gray-600">
                {getLanguageEmoji(comment.language)}
                {comment.language}
              </span>
              <span className="flex items-center gap-1 text-gray-500">
                <User size={12} />
                {comment.validatedByUsername}
              </span>
              <span className="flex items-center gap-1 text-gray-500">
                <Calendar size={12} />
                {new Date(comment.validatedAt).toLocaleDateString()}
              </span>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
              <Clock size={14} />
              <span>Pending validation</span>
            </div>
          )}

          {/* Validation Form (for unvalidated comments) */}
          {!comment.isValidated && canValidate && (
            <div className={`mt-3 pt-3 border-t transition-all ${isExpanded ? 'block' : 'hidden'}`}>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={validationData.language}
                  onChange={(e) =>
                    setValidationData({ ...validationData, language: e.target.value })
                  }
                  className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Language</option>
                  <option value="Bangla">Bangla</option>
                  <option value="English">English</option>
                  <option value="Banglish">Banglish</option>
                  <option value="Emoji">Emoji</option>
                  <option value="Other">Other</option>
                </select>

                <select
                  value={validationData.sentiment}
                  onChange={(e) =>
                    setValidationData({ ...validationData, sentiment: e.target.value })
                  }
                  className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Sentiment</option>
                  <option value="Positive">Positive</option>
                  <option value="Negative">Negative</option>
                  <option value="Neutral">Neutral</option>
                </select>

                <button
                  onClick={handleValidate}
                  disabled={isValidating}
                  className="bg-green-500 text-white px-4 py-1.5 rounded-lg hover:bg-green-600 transition disabled:bg-green-300 text-sm"
                >
                  {isValidating ? 'Validating...' : 'Validate'}
                </button>
              </div>
            </div>
          )}

          {/* Toggle expand button for unvalidated comments */}
          {!comment.isValidated && canValidate && !isExpanded && (
            <button
              onClick={() => setIsExpanded(true)}
              className="mt-2 text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
            >
              <ChevronDown size={14} />
              Validate this comment
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CommentCard