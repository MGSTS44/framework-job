import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
// import { getFramework, saveFramework } from '../lib/api'
import LoadingDialog from './LoadingDialog' //更新：使用 LoadingDialog 替代 RegenerateDialog
import { getFramework, updateFramework } from '../lib/firebase'
import { useAuth } from '../contexts/AuthContext'
import MergeModeDialog from './MergeModeDialog'
import ManualMergeMode from './ManualMergeMode'
import AIMergeMode from './AIMergeMode'

function FrameworkEditor() {
  const navigate = useNavigate()
  const { user: _user } = useAuth()
  const { id } = useParams()

  // UI state management
  const [activeSection, setActiveSection] = useState('metadata')
  const [isSaved, setIsSaved] = useState(true)
  const [showMergeModeDialog, setShowMergeModeDialog] = useState(false)
  const [mergeMode, setMergeMode] = useState(null) // null | 'manual' | 'ai'
  const [isInMergeMode, setIsInMergeMode] = useState(false)

  // 更新：只保留 isRegenerating 状态
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Framework data structure with mock initial values
  const [frameworkData, setFrameworkData] = useState({
    id: id || 'framework-001',
    metadata: {
      title: 'New Framework',
      version: '1.0.0',
      tags: 'Tag1, Tag2, Tag3',
      lastUpdated: new Date().toISOString(),
    },
    steps: [
      {
        id: 'step-1',
        name: 'Planning Phase',
        description: 'Provide a brief explanation of this framework',
        subSteps: [
          'Resource allocation',
          'Timeline development',
          'Risk assessment',
        ],
      },
    ],
    artefacts: {
      default: {
        type: 'Concept Pack',
        description: '',
      },
      additional: [
        {
          id: 'art-1',
          name: 'User Journey Map',
          description: 'Visual representation of user interactions',
          selected: true,
        },
        {
          id: 'art-2',
          name: 'Wireframes',
          description: 'Low-fidelity interface layouts',
          selected: false,
        },
      ],
    },
    risks: [
      {
        id: 'risk-1',
        title: 'Bundled consents',
        description: 'Provide a brief explanation of this risk',
      },
    ],
    escalation: [
      {
        id: 'esc-1',
        trigger: 'Division 7A loans',
        action: 'Escalate to tax specialist',
      },
      {
        id: 'esc-2',
        trigger: 'Health/financial data flows',
        action: 'Escalate to privacy counsel',
      },
    ],
  })

  // Auto-save draft to localStorage with 500ms debounce
  useEffect(() => {
    if (!isSaved && frameworkData && id) {
      const timer = setTimeout(async () => {
        try {
          // 保存到 Firestore
          await updateFramework(id, {
            metadata: frameworkData.metadata,
            steps: frameworkData.steps,
            artefacts: frameworkData.artefacts,
            risks: frameworkData.risks,
            escalation: frameworkData.escalation,
            _raw: frameworkData._raw,
          })

          // 也保存到 localStorage（备份）
          localStorage.setItem(
            `framework-draft-${id}`,
            JSON.stringify(frameworkData)
          )

          console.log('✅ Auto-saved to Firestore and localStorage')
          setIsSaved(true)
        } catch (error) {
          console.error('❌ Auto-save failed:', error)
          // 失败时只保存到 localStorage
          localStorage.setItem(
            `framework-draft-${id}`,
            JSON.stringify(frameworkData)
          )
        }
      }, 2000) // 2秒延迟，避免频繁保存

      return () => clearTimeout(timer)
    }
  }, [frameworkData, isSaved, id])

  // Load framework from backend when component mounts
  // COMMENTED OUT: Temporarily disabled until backend API is ready
  /*
  useEffect(() => {
    async function loadFramework() {
      try {
        const response = await getFramework(id);
        if (response.success) {
          const serverData = response.data;
          
          const localDraft = localStorage.getItem(`framework-draft-${id}`);
          
          if (localDraft) {
            const draftData = JSON.parse(localDraft);
            const draftTime = new Date(draftData.metadata.lastUpdated);
            const serverTime = new Date(serverData.metadata.lastUpdated);
            
            if (draftTime > serverTime) {
              const shouldRestore = window.confirm(
                'Found unsaved local changes. Do you want to restore them?'
              );
              
              if (shouldRestore) {
                setFrameworkData(draftData);
                setIsSaved(false);
                return;
              }
            }
            
            localStorage.removeItem(`framework-draft-${id}`);
          }
          
          setFrameworkData(serverData);
          setIsSaved(true);
        }
      } catch (error) {
        const localDraft = localStorage.getItem(`framework-draft-${id}`);
        if (localDraft) {
          const shouldUseLocal = window.confirm(
            'Failed to load from server. Use local draft?'
          );
          if (shouldUseLocal) {
            setFrameworkData(JSON.parse(localDraft));
            setIsSaved(false);
            return;
          }
        }
        alert(`Failed to load framework: ${error.message}`);
        navigate('/');
      }
    }
    
    if (id) {
      loadFramework();
    }
  }, [id, navigate]);
  */

  //从 Firestore 加载 Framework
  useEffect(() => {
    if (!id) return

    const loadFramework = async () => {
      try {
        setIsLoading(true)
        console.log('📥 Loading framework from Firestore:', id)

        // 从 Firestore 加载
        const data = await getFramework(id)
        console.log('✅ Framework loaded:', data)

        setFrameworkData({
          id: data.id,
          metadata: data.metadata || {
            title: 'New Framework',
            version: '1.0.0',
            tags: '',
            lastUpdated: new Date().toISOString(),
          },
          steps: data.steps || [],
          artefacts: {
            default: {
              type: String(data.artefacts?.default?.type || 'Concept Pack'),
              description: String(data.artefacts?.default?.description || ''),
            },
            additional: (data.artefacts?.additional || []).map(art => ({
              id: art.id,
              name: String(art.name || ''),
              description: String(art.description || ''),
              selected: Boolean(art.selected),
            })),
          },
          risks: data.risks || [],
          escalation: data.escalation || [],
          _raw:
            typeof data._raw === 'string'
              ? JSON.parse(data._raw)
              : data._raw || {},
        })

        setIsSaved(true)
        setIsLoading(false)
      } catch (error) {
        console.error('❌ Error loading framework:', error)

        // Fallback: 尝试从 localStorage 加载
        const localDraft = localStorage.getItem(`framework-draft-${id}`)
        if (localDraft) {
          console.log('⚠️ Loading from localStorage as fallback')
          const parsedData = JSON.parse(localDraft)
          setFrameworkData(parsedData)
          setIsSaved(false)
        } else {
          alert('Failed to load framework. It may have been deleted.')
          navigate('/frameworks')
        }
        setIsLoading(false)
      }
    }

    loadFramework()
  }, [id, navigate])

  // Warn user before leaving page with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = e => {
      if (!isSaved) {
        e.preventDefault()
        e.returnValue =
          'You have unsaved changes. Are you sure you want to leave?'
        return e.returnValue
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [isSaved])

  // Steps management functions
  const updateStep = (stepId, field, value) => {
    setFrameworkData({
      ...frameworkData,
      steps: frameworkData.steps.map(step =>
        step.id === stepId ? { ...step, [field]: value } : step
      ),
    })
    setIsSaved(false)
  }

  const addSubStep = stepId => {
    setFrameworkData({
      ...frameworkData,
      steps: frameworkData.steps.map(step =>
        step.id === stepId
          ? { ...step, subSteps: [...step.subSteps, ''] }
          : step
      ),
    })
    setIsSaved(false)
  }

  const updateSubStep = (stepId, subStepIndex, value) => {
    setFrameworkData({
      ...frameworkData,
      steps: frameworkData.steps.map(step =>
        step.id === stepId
          ? {
              ...step,
              subSteps: step.subSteps.map((sub, idx) =>
                idx === subStepIndex ? value : sub
              ),
            }
          : step
      ),
    })
    setIsSaved(false)
  }

  const removeSubStep = (stepId, subStepIndex) => {
    setFrameworkData({
      ...frameworkData,
      steps: frameworkData.steps.map(step =>
        step.id === stepId
          ? {
              ...step,
              subSteps: step.subSteps.filter((_, idx) => idx !== subStepIndex),
            }
          : step
      ),
    })
    setIsSaved(false)
  }

  const addStep = () => {
    const newStep = {
      id: `step-${Date.now()}`,
      name: '',
      description: '',
      subSteps: [],
    }
    setFrameworkData({
      ...frameworkData,
      steps: [...frameworkData.steps, newStep],
    })
    setIsSaved(false)
  }

  const removeStep = stepId => {
    setFrameworkData({
      ...frameworkData,
      steps: frameworkData.steps.filter(step => step.id !== stepId),
    })
    setIsSaved(false)
  }

  // Artefacts management functions
  const updateDefaultArtefact = (field, value) => {
    setFrameworkData({
      ...frameworkData,
      artefacts: {
        ...frameworkData.artefacts,
        default: { ...frameworkData.artefacts.default, [field]: value },
      },
    })
    setIsSaved(false)
  }

  const toggleArtefactSelection = artefactId => {
    setFrameworkData({
      ...frameworkData,
      artefacts: {
        ...frameworkData.artefacts,
        additional: frameworkData.artefacts.additional.map(art =>
          art.id === artefactId ? { ...art, selected: !art.selected } : art
        ),
      },
    })
    setIsSaved(false)
  }

  const updateAdditionalArtefact = (artefactId, field, value) => {
    setFrameworkData({
      ...frameworkData,
      artefacts: {
        ...frameworkData.artefacts,
        additional: frameworkData.artefacts.additional.map(art =>
          art.id === artefactId ? { ...art, [field]: value } : art
        ),
      },
    })
    setIsSaved(false)
  }

  const addArtefact = () => {
    const newArtefact = {
      id: `art-${Date.now()}`,
      name: '',
      description: '',
      selected: false,
    }
    setFrameworkData({
      ...frameworkData,
      artefacts: {
        ...frameworkData.artefacts,
        additional: [...frameworkData.artefacts.additional, newArtefact],
      },
    })
    setIsSaved(false)
  }

  const removeArtefact = artefactId => {
    setFrameworkData({
      ...frameworkData,
      artefacts: {
        ...frameworkData.artefacts,
        additional: frameworkData.artefacts.additional.filter(
          art => art.id !== artefactId
        ),
      },
    })
    setIsSaved(false)
  }

  // Risks management functions
  const updateRisk = (riskId, field, value) => {
    setFrameworkData({
      ...frameworkData,
      risks: frameworkData.risks.map(risk =>
        risk.id === riskId ? { ...risk, [field]: value } : risk
      ),
    })
    setIsSaved(false)
  }

  const addRisk = () => {
    const newRisk = {
      id: `risk-${Date.now()}`,
      title: '',
      description: '',
    }
    setFrameworkData({
      ...frameworkData,
      risks: [...frameworkData.risks, newRisk],
    })
    setIsSaved(false)
  }

  const removeRisk = riskId => {
    if (frameworkData.risks.length === 1) {
      alert('At least one risk must be defined')
      return
    }
    setFrameworkData({
      ...frameworkData,
      risks: frameworkData.risks.filter(risk => risk.id !== riskId),
    })
    setIsSaved(false)
  }

  // Escalation paths management functions
  const updateEscalation = (escalationId, field, value) => {
    setFrameworkData({
      ...frameworkData,
      escalation: frameworkData.escalation.map(esc =>
        esc.id === escalationId ? { ...esc, [field]: value } : esc
      ),
    })
    setIsSaved(false)
  }

  const addEscalation = () => {
    const newEscalation = {
      id: `esc-${Date.now()}`,
      trigger: '',
      action: '',
    }
    setFrameworkData({
      ...frameworkData,
      escalation: [...frameworkData.escalation, newEscalation],
    })
    setIsSaved(false)
  }

  const removeEscalation = escalationId => {
    if (frameworkData.escalation.length === 1) {
      alert('At least one escalation path must be defined')
      return
    }
    setFrameworkData({
      ...frameworkData,
      escalation: frameworkData.escalation.filter(
        esc => esc.id !== escalationId
      ),
    })
    setIsSaved(false)
  }

  // Event handlers for top-level actions
  const handleDiscardChanges = () => {
    if (window.confirm('Are you sure you want to discard all changes?')) {
      navigate('/')
    }
  }

  const handleExportMarkdown = async () => {
    try {
      console.log('📄 Exporting framework as Markdown...')

      // 调用后端 API
      const response = await fetch(
        'http://localhost:8000/api/frameworks/export-markdown',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(frameworkData),
        }
      )

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`)
      }

      // 获取 Markdown 文件
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)

      // 生成文件名
      const title = frameworkData.metadata.title || 'framework'
      const safeTitle = title
        .replace(/[^a-zA-Z0-9\s-_]/g, '_')
        .replace(/\s+/g, '_')
      const filename = `${safeTitle}.md`

      // 触发下载
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      console.log('✅ Markdown file downloaded successfully')
    } catch (error) {
      console.error('❌ Export failed:', error)
      alert(`Failed to export: ${error.message}`)
    }
  }

  // 🔥 更新：Re-generate button handler - 直接开始regeneration，显示loading dialog
  const handleRegenerate = async () => {
    setIsRegenerating(true)

    try {
      console.log('🔄 Starting regeneration...')

      const response = await fetch(
        'http://localhost:8000/api/frameworks/regenerate',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            framework: frameworkData,
            use_local: false, // 默认使用云端处理
          }),
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.success) {
        console.log('✅ Framework regenerated:', result.framework)

        const updatedData = {
          ...frameworkData,
          ...result.framework,
          _raw: {
            ...frameworkData._raw,
            framework: result.framework,
          },
          metadata: {
            ...frameworkData.metadata,
            lastUpdated: new Date().toISOString(),
          },
        }

        // ✅ 保存到 Firestore
        try {
          await updateFramework(id, {
            metadata: updatedData.metadata,
            steps: updatedData.steps,
            artefacts: updatedData.artefacts,
            risks: updatedData.risks,
            escalation: updatedData.escalation,
            _raw: updatedData._raw,
          })
          console.log('✅ Saved regenerated framework to Firestore')
        } catch (saveError) {
          console.error('❌ Failed to save to Firestore:', saveError)
        }

        setFrameworkData(updatedData)
        setIsSaved(false) // 标记为未保存，触发自动保存
        alert('Framework regenerated successfully! Please review the changes.')
      } else {
        throw new Error(result.message || 'Regeneration failed')
      }
    } catch (error) {
      console.error('❌ Regeneration failed:', error)
      alert(`Failed to regenerate framework: ${error.message}`)
    } finally {
      setIsRegenerating(false)
    }
  }

  // Save Draft button handler - saves locally without backend call
  const handleSaveDraft = async () => {
    console.log('💾 Saving draft...')

    try {
      const updatedData = {
        ...frameworkData,
        metadata: {
          ...frameworkData.metadata,
          lastUpdated: new Date().toISOString(),
        },
      }

      // 保存到 Firestore
      await updateFramework(id, {
        metadata: updatedData.metadata,
        steps: updatedData.steps,
        artefacts: updatedData.artefacts,
        risks: updatedData.risks,
        escalation: updatedData.escalation,
        _raw: updatedData._raw,
      })

      // 也保存到 localStorage
      localStorage.setItem(`framework-draft-${id}`, JSON.stringify(updatedData))

      setFrameworkData(updatedData)
      setIsSaved(true)
      alert('✅ Draft saved successfully!')
    } catch (error) {
      console.error('❌ Save failed:', error)
      alert('Failed to save draft. Please try again.')
    }
  }

  // Render different content sections based on active tab
  const renderContent = () => {
    switch (activeSection) {
      case 'metadata':
        return (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Framework Metadata
            </h2>
            <p className="text-gray-600 mb-6">
              Configure the basic information for your framework.
            </p>

            <div className="space-y-6">
              {/* First row: Title and Version */}
              <div className="grid grid-cols-2 gap-6">
                {/* Title field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={frameworkData.metadata.title}
                    onChange={e => {
                      setFrameworkData({
                        ...frameworkData,
                        metadata: {
                          ...frameworkData.metadata,
                          title: e.target.value,
                        },
                      })
                      setIsSaved(false)
                    }}
                    placeholder="New Framework"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Version field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Version
                  </label>
                  <input
                    type="text"
                    value={frameworkData.metadata.version}
                    onChange={e => {
                      setFrameworkData({
                        ...frameworkData,
                        metadata: {
                          ...frameworkData.metadata,
                          version: e.target.value,
                        },
                      })
                      setIsSaved(false)
                    }}
                    placeholder="1.0.0"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Second row: Tags and Last Updated */}
              <div className="grid grid-cols-2 gap-6">
                {/* Tags field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={frameworkData.metadata.tags}
                    onChange={e => {
                      setFrameworkData({
                        ...frameworkData,
                        metadata: {
                          ...frameworkData.metadata,
                          tags: e.target.value,
                        },
                      })
                      setIsSaved(false)
                    }}
                    placeholder="Tag1, Tag2, Tag3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Separate tags with commas
                  </p>
                </div>

                {/* Last Updated field (read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Updated
                  </label>
                  <input
                    type="text"
                    value={new Date(
                      frameworkData.metadata.lastUpdated
                    ).toLocaleString()}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                  />
                </div>
              </div>
              {/*新增：Third row - Points of View (POV) */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Points of View (POV)
                  <span className="ml-2 text-xs text-gray-500 font-normal">
                    Core principles guiding this framework
                  </span>
                </label>

                {(() => {
                  // 尝试从 _raw 中解析 POV
                  let pov = []

                  try {
                    // 如果 _raw 是字符串，解析它
                    const rawData =
                      typeof frameworkData._raw === 'string'
                        ? JSON.parse(frameworkData._raw)
                        : frameworkData._raw

                    // 获取 POV 数组
                    pov = rawData?.framework?.pov || []
                  } catch (error) {
                    console.error('Failed to parse POV:', error)
                  }

                  if (Array.isArray(pov) && pov.length > 0) {
                    // 有 POV 数据 - 显示蓝色卡片列表
                    return (
                      <div className="space-y-3">
                        {pov.map((point, index) => (
                          <div
                            key={index}
                            className="flex items-start space-x-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg hover:shadow-md transition-all duration-200"
                          >
                            <span className="flex-shrink-0 w-7 h-7 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-full flex items-center justify-center text-sm font-semibold shadow-sm">
                              {index + 1}
                            </span>
                            <p className="flex-1 text-sm text-gray-800 leading-relaxed pt-0.5">
                              {point}
                            </p>
                          </div>
                        ))}
                      </div>
                    )
                  } else {
                    // 没有 POV 数据 - 显示灰色提示
                    return (
                      <div className="p-8 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center">
                        <svg
                          className="w-12 h-12 mx-auto text-gray-400 mb-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                          />
                        </svg>
                        <p className="text-sm text-gray-600 font-medium mb-2">
                          No points of view defined yet
                        </p>
                        <p className="text-xs text-gray-500">
                          Click{' '}
                          <span className="font-semibold text-purple-600">
                            "Re-generate"
                          </span>{' '}
                          below to add guiding principles
                        </p>
                      </div>
                    )
                  }
                })()}
              </div>
            </div>
          </div>
        )

      case 'steps':
        return (
          <div>
            {/* 标题行：添加 Manual Merge 按钮 */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold text-gray-900">
                Framework Stages
              </h2>

              {/* Manual Merge 按钮 */}
              <button
                onClick={() => setShowMergeModeDialog(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
                Manual Merge
              </button>
            </div>

            <p className="text-gray-600 mb-6">
              Each stage represents a recommended framework or approach. You can
              customize, merge, or create new stages.
            </p>

            <div className="space-y-6">
              {/* Steps list */}
              {frameworkData.steps.map((step, stepIndex) => (
                <div
                  key={step.id}
                  className="border border-gray-200 rounded-lg p-6 bg-gray-50"
                >
                  {/* Step header with delete button */}
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Framework {stepIndex + 1}
                    </h3>
                    {frameworkData.steps.length > 1 && (
                      <button
                        onClick={() => removeStep(step.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete framework"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Step name input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Framework Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={step.name}
                      onChange={e =>
                        updateStep(step.id, 'name', e.target.value)
                      }
                      placeholder="Planning Phase"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    />
                  </div>

                  {/* Step description textarea */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Framework Description
                    </label>
                    <textarea
                      value={step.description}
                      onChange={e =>
                        updateStep(step.id, 'description', e.target.value)
                      }
                      placeholder="Provide a brief explanation of this framework"
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white"
                    />
                  </div>

                  {/* Sub-steps list */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sub-steps / Key Points
                    </label>

                    <div className="space-y-2">
                      {step.subSteps.map((subStep, subIndex) => (
                        <div
                          key={subIndex}
                          className="flex items-center space-x-2"
                        >
                          <input
                            type="text"
                            value={subStep}
                            onChange={e =>
                              updateSubStep(step.id, subIndex, e.target.value)
                            }
                            placeholder="Resource allocation"
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                          />
                          <button
                            onClick={() => removeSubStep(step.id, subIndex)}
                            className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                            title="Remove sub-step"
                          >
                            <svg
                              className="w-5 h-5"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add sub-step button */}
                    <button
                      onClick={() => addSubStep(step.id)}
                      className="mt-3 text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center space-x-1"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              ))}

              {/* Add step button */}
              <button
                onClick={addStep}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Add Framework</span>
              </button>
            </div>
          </div>
        )

      case 'artefacts':
        return (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Artefacts
            </h2>
            <p className="text-gray-600 mb-6">
              Define the deliverables and outputs of your framework.
            </p>

            <div className="space-y-6">
              {/* Default artefact section */}
              <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Default Artefact
                </h3>

                {/* Artefact type dropdown */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Artefact Type
                  </label>
                  {(() => {
                    // ✅ 预定义的通用选项(按使用频率排序)
                    const commonTypes = [
                      'Concept Pack',
                      'Framework Document',
                      'Question Set Document',
                      'Health Assessment Report',
                      'Wellbeing Assessment Tool',
                      'Compliance Checklist',
                      'AI Implementation Plan',
                      'Strategic Plan',
                      'Technical Specification',
                      'Research Report',
                      'Wireframes',
                      'Prototype',
                      'User Journey Map',
                      'Documentation',
                    ]

                    // 当前值
                    const currentType = frameworkData.artefacts.default.type

                    // 如果当前值不在预定义列表中,添加到列表开头
                    const allTypes =
                      currentType && !commonTypes.includes(currentType)
                        ? [currentType, ...commonTypes]
                        : commonTypes

                    return (
                      <select
                        value={currentType}
                        onChange={e =>
                          updateDefaultArtefact('type', e.target.value)
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                      >
                        {allTypes.map(type => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    )
                  })()}
                </div>

                {/* Description textarea */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={frameworkData.artefacts.default.description}
                    onChange={e =>
                      updateDefaultArtefact('description', e.target.value)
                    }
                    placeholder="Provide additional context for this artefact"
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white"
                  />
                </div>
              </div>

              {/* Additional artefacts section */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Additional Artefacts
                </h3>

                {/* Artefacts table */}
                {frameworkData.artefacts.additional.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="w-12 px-4 py-3"></th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                            Name
                          </th>
                          <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">
                            Description / Use case
                          </th>
                          <th className="w-12 px-4 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {frameworkData.artefacts.additional.map(artefact => (
                          <tr
                            key={artefact.id}
                            className="border-b border-gray-200 last:border-b-0"
                          >
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={artefact.selected}
                                onChange={() =>
                                  toggleArtefactSelection(artefact.id)
                                }
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={String(artefact.name || '')} // ✅ 强制转换为字符串
                                onChange={e =>
                                  updateAdditionalArtefact(
                                    artefact.id,
                                    'name',
                                    e.target.value
                                  )
                                }
                                placeholder="User Journey Map"
                                className="w-full px-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={String(artefact.description || '')} // ✅ 强制转换为字符串
                                onChange={e =>
                                  updateAdditionalArtefact(
                                    artefact.id,
                                    'description',
                                    e.target.value
                                  )
                                }
                                placeholder="Visual representation of user interactions"
                                className="w-full px-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => removeArtefact(artefact.id)}
                                className="text-red-600 hover:text-red-800"
                                title="Delete artefact"
                              >
                                <svg
                                  className="w-5 h-5"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add artefact button */}
                <button
                  onClick={addArtefact}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Add Artefact</span>
                </button>
              </div>
            </div>
          </div>
        )

      case 'risks':
        return (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Risks</h2>
            <p className="text-gray-600 mb-6">
              Identify and document potential risks in your framework.
            </p>

            <div className="space-y-6">
              {/* Risks list */}
              {frameworkData.risks.map((risk, riskIndex) => (
                <div
                  key={risk.id}
                  className="border border-gray-200 rounded-lg p-6 bg-gray-50"
                >
                  {/* Risk header with delete button */}
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Risk {riskIndex + 1}
                    </h3>
                    {frameworkData.risks.length > 1 && (
                      <button
                        onClick={() => removeRisk(risk.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete risk"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Risk title input */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Risk Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={risk.title}
                      onChange={e =>
                        updateRisk(risk.id, 'title', e.target.value)
                      }
                      placeholder="Bundled consents"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    />
                  </div>

                  {/* Risk description textarea */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Risk Description
                    </label>
                    <textarea
                      value={risk.description}
                      onChange={e =>
                        updateRisk(risk.id, 'description', e.target.value)
                      }
                      placeholder="Provide a brief explanation of this risk"
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white"
                    />
                  </div>
                </div>
              ))}

              {/* Add risk button */}
              <button
                onClick={addRisk}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Add Risk</span>
              </button>
            </div>
          </div>
        )

      case 'escalation':
        return (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Escalation
            </h2>
            <p className="text-gray-600 mb-6">
              Define escalation paths and triggers for your framework.
            </p>

            <div className="space-y-4">
              {/* Escalation paths list 
              we didn't use index for now, but to pass the test we comment for now
              {frameworkData.escalation.map((escalation, index) => ( 
              */}
              {frameworkData.escalation.map(escalation => (
                <div
                  key={escalation.id}
                  className="border border-gray-200 rounded-lg p-6 bg-white"
                >
                  {/* Delete button */}
                  {frameworkData.escalation.length > 1 && (
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={() => removeEscalation(escalation.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Delete escalation path"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  )}

                  {/* Two column layout for trigger and action */}
                  <div className="grid grid-cols-2 gap-6">
                    {/* Trigger condition input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Trigger Condition
                      </label>
                      <input
                        type="text"
                        value={escalation.trigger}
                        onChange={e =>
                          updateEscalation(
                            escalation.id,
                            'trigger',
                            e.target.value
                          )
                        }
                        placeholder="Division 7A loans"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                      />
                    </div>

                    {/* Action recommendation input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Action Recommendation
                      </label>
                      <input
                        type="text"
                        value={escalation.action}
                        onChange={e =>
                          updateEscalation(
                            escalation.id,
                            'action',
                            e.target.value
                          )
                        }
                        placeholder="Escalate to tax specialist"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Add escalation path button */}
              <button
                onClick={addEscalation}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Add Escalation Path</span>
              </button>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <>
      {/* ========== 条件渲染：Manual Merge Mode vs AI Merge Mode vs 正常编辑模式 ========== */}
      {isInMergeMode && mergeMode === 'manual' ? (
        // Manual Merge Mode 界面
        <ManualMergeMode
          frameworks={frameworkData.steps || []}
          onExit={() => {
            setIsInMergeMode(false)
            setMergeMode(null)
          }}
          onSave={mergedFrameworks => {
            setFrameworkData({
              ...frameworkData,
              steps: mergedFrameworks,
            })
            setIsSaved(false)
          }}
        />
      ) : isInMergeMode && mergeMode === 'ai' ? (
        // 新增：AI Merge Mode 界面
        <AIMergeMode
          frameworks={frameworkData.steps || []}
          onExit={() => {
            setIsInMergeMode(false)
            setMergeMode(null)
          }}
          onSave={mergedFrameworks => {
            setFrameworkData({
              ...frameworkData,
              steps: mergedFrameworks,
            })
            setIsSaved(false)
          }}
        />
      ) : (
        <div className="min-h-screen bg-gray-50">
          {/* Top header bar */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">
                  Draft Framework Editor
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Edit and refine your framework draft
                </p>
              </div>

              {/* Save status indicator */}
              <div
                className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                  isSaved
                    ? 'bg-green-50 text-green-700'
                    : 'bg-yellow-50 text-yellow-700'
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  {isSaved ? (
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  ) : (
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z"
                      clipRule="evenodd"
                    />
                  )}
                </svg>
                <span className="font-medium">
                  {isSaved ? 'Saved' : 'Unsaved Changes'}
                </span>
              </div>
            </div>
          </div>

          {/* Main content area */}
          <div className="max-w-7xl mx-auto px-6 py-8 pb-32">
            <div className="flex space-x-6">
              {/* Left sidebar navigation */}
              <div className="w-80 flex-shrink-0">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="font-medium text-gray-700">
                      Framework Outline
                    </h3>
                  </div>

                  <nav className="p-2">
                    <button
                      onClick={() => setActiveSection('metadata')}
                      className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                        activeSection === 'metadata'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Metadata
                    </button>

                    <button
                      onClick={() => setActiveSection('steps')}
                      className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                        activeSection === 'steps'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Framework Stages
                    </button>

                    <button
                      onClick={() => setActiveSection('artefacts')}
                      className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                        activeSection === 'artefacts'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Artefacts
                    </button>

                    <button
                      onClick={() => setActiveSection('risks')}
                      className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                        activeSection === 'risks'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Risks
                    </button>

                    <button
                      onClick={() => setActiveSection('escalation')}
                      className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-colors ${
                        activeSection === 'escalation'
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      Escalation
                    </button>
                  </nav>
                </div>
              </div>

              {/* Right content area */}
              <div className="flex-1">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-96">
                  {renderContent()}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom action bar */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={handleDiscardChanges}
                className="px-5 py-2 text-gray-700 hover:text-gray-900 font-medium transition-colors"
              >
                Discard Changes
              </button>

              <button
                onClick={handleExportMarkdown}
                className="px-5 py-2 border border-gray-300 text-gray-700 rounded font-medium hover:bg-gray-50 transition-colors flex items-center space-x-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                  />
                </svg>
                <span>Export .md</span>
              </button>

              {/* Re-generate button */}
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className={`px-5 py-2 bg-purple-600 text-white rounded font-medium hover:bg-purple-700 transition-colors flex items-center space-x-2 ${
                  isRegenerating ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isRegenerating ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Regenerating...</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    <span>Re-generate</span>
                  </>
                )}
              </button>

              {/* Save Draft button */}
              <button
                onClick={handleSaveDraft}
                className="px-5 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
                <span>Save Draft</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <LoadingDialog
        isOpen={isRegenerating || isLoading}
        message={isLoading ? 'Loading Framework' : 'Re-generating Framework'}
        subMessage={
          isLoading
            ? 'Please wait while we load your framework...'
            : 'Please wait while we enhance your framework with AI...'
        }
      />

      <MergeModeDialog
        isOpen={showMergeModeDialog}
        onClose={() => setShowMergeModeDialog(false)}
        onProceed={mode => {
          setMergeMode(mode)
          setIsInMergeMode(true)
          if (mode === 'manual') {
            console.log('Entering Manual Merge Mode')
          } else if (mode === 'ai') {
            console.log('Entering AI Merge Mode')
          }
        }}
      />
    </>
  )
}

export default FrameworkEditor
