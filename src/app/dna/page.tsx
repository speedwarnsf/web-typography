"use client"

import { useState } from 'react'

const SAMPLE_HTML = `
<!DOCTYPE html>
<html>
<head>
<style>
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-serif: Georgia, serif;
}
body {
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.6;
  color: #1a1a1a;
  margin: 40px;
}
h1 {
  font-family: var(--font-serif);
  font-size: 48px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: #000;
  margin-bottom: 24px;
}
h2 {
  font-family: var(--font-serif);
  font-size: 32px;
  font-weight: 600;
  line-height: 1.3;
  color: #111;
  margin-bottom: 16px;
}
p {
  font-size: 18px;
  line-height: 1.75;
  margin-bottom: 16px;
  color: #333;
}
.caption {
  font-size: 14px;
  line-height: 1.5;
  color: #666;
  letter-spacing: 0.01em;
}
</style>
</head>
<body>
<h1>Sample Article Heading</h1>
<p>This is a sample paragraph with some body text to demonstrate the typography system in use.</p>
<h2>Subheading Example</h2>
<p>Another paragraph here showing line height and spacing patterns.</p>
<p class="caption">A caption with smaller text and different spacing.</p>
</body>
</html>
`

interface ExtractedDNA {
  fontStacks: { family: string; usage: string; elements: string[] }[]
  typeScale: { size: string; ratio?: number; elements: string[] }[]
  weightMap: { weight: string; elements: string[] }[]
  lineHeights: { value: string; fontSize: string; ratio: number; elements: string[] }[]
  letterSpacing: { value: string; elements: string[] }[]
  colors: { color: string; count: number; elements: string[] }[]
  spacing: { property: string; value: string; count: number }[]
  verticalRhythm: { baseUnit: number | null; gridDetected: boolean }
  responsivePatterns: { pattern: string; property: string; elements: string[] }[]
}

export default function DNAPage() {
  const [htmlInput, setHtmlInput] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [inputMode, setInputMode] = useState<'url' | 'html'>('url')
  const [extractedDNA, setExtractedDNA] = useState<ExtractedDNA | null>(null)
  const [isExtracting, setIsExtracting] = useState(false)
  const [fetchError, setFetchError] = useState('')

  const loadSample = () => {
    setHtmlInput(SAMPLE_HTML)
  }

  const extractDNA = async () => {
    setFetchError('')
    if (inputMode === 'url') {
      const url = urlInput.trim()
      if (!url) return
      setIsExtracting(true)
      try {
        const normalizedUrl = url.match(/^https?:\/\//) ? url : `https://${url}`
        const res = await fetch(`/api/fetch-url?url=${encodeURIComponent(normalizedUrl)}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Failed to fetch (${res.status})`)
        }
        const { html } = await res.json()
        setIsExtracting(false)
        runExtraction(html)
      } catch (err: any) {
        setFetchError(err.message || 'Failed to fetch URL')
        setIsExtracting(false)
      }
    } else {
      if (!htmlInput.trim()) return
      runExtraction(htmlInput)
    }
  }

  const runExtraction = (html: string) => {
    setIsExtracting(true)

    // Create hidden iframe
    const iframe = document.createElement('iframe')
    iframe.style.position = 'absolute'
    iframe.style.left = '-9999px'
    iframe.style.width = '1200px'
    iframe.style.height = '800px'
    document.body.appendChild(iframe)

    iframe.srcdoc = html

    iframe.onload = () => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
        if (!iframeDoc) throw new Error('Cannot access iframe document')

        const allElements = iframeDoc.querySelectorAll('*')

        // Data collectors
        const fontFamilies = new Map<string, { usage: string; elements: Set<string> }>()
        const fontSizes = new Map<string, Set<string>>()
        const fontWeights = new Map<string, Set<string>>()
        const lineHeightMap = new Map<string, { fontSize: string; elements: Set<string> }>()
        const letterSpacingMap = new Map<string, Set<string>>()
        const colorMap = new Map<string, Set<string>>()
        const spacingMap = new Map<string, number>()
        const responsivePatterns: { pattern: string; property: string; elements: string[] }[] = []

        allElements.forEach((el) => {
          const computed = iframe.contentWindow!.getComputedStyle(el)
          const tagName = el.tagName.toLowerCase()
          const className = el.className ? `.${el.className.split(' ')[0]}` : ''
          const identifier = className || tagName

          // Font families
          const fontFamily = computed.fontFamily
          if (fontFamily) {
            const usage = /^h[1-6]$/.test(tagName) ? 'heading' :
                         /code|pre/.test(tagName) ? 'monospace' : 'body'
            if (!fontFamilies.has(fontFamily)) {
              fontFamilies.set(fontFamily, { usage, elements: new Set() })
            }
            fontFamilies.get(fontFamily)!.elements.add(identifier)
          }

          // Font sizes
          const fontSize = computed.fontSize
          if (fontSize && fontSize !== '0px') {
            if (!fontSizes.has(fontSize)) fontSizes.set(fontSize, new Set())
            fontSizes.get(fontSize)!.add(identifier)

            // Check for responsive patterns
            const styleText = Array.from(iframeDoc.styleSheets).flatMap(sheet => {
              try {
                return Array.from(sheet.cssRules).map(rule => rule.cssText)
              } catch {
                return []
              }
            }).join('\n')

            const clampMatch = styleText.match(/font-size:\s*(clamp\([^)]+\))/i)
            const minMaxMatch = styleText.match(/font-size:\s*(min\([^)]+\)|max\([^)]+\))/i)

            if (clampMatch && !responsivePatterns.find(p => p.pattern === clampMatch[1])) {
              responsivePatterns.push({
                pattern: clampMatch[1],
                property: 'font-size',
                elements: [identifier]
              })
            }
            if (minMaxMatch && !responsivePatterns.find(p => p.pattern === minMaxMatch[1])) {
              responsivePatterns.push({
                pattern: minMaxMatch[1],
                property: 'font-size',
                elements: [identifier]
              })
            }
          }

          // Font weights
          const fontWeight = computed.fontWeight
          if (fontWeight) {
            if (!fontWeights.has(fontWeight)) fontWeights.set(fontWeight, new Set())
            fontWeights.get(fontWeight)!.add(identifier)
          }

          // Line heights
          const lineHeight = computed.lineHeight
          if (lineHeight && lineHeight !== 'normal' && fontSize) {
            const key = `${lineHeight}@${fontSize}`
            if (!lineHeightMap.has(key)) {
              lineHeightMap.set(key, { fontSize, elements: new Set() })
            }
            lineHeightMap.get(key)!.elements.add(identifier)
          }

          // Letter spacing
          const letterSpacing = computed.letterSpacing
          if (letterSpacing && letterSpacing !== 'normal' && letterSpacing !== '0px') {
            if (!letterSpacingMap.has(letterSpacing)) letterSpacingMap.set(letterSpacing, new Set())
            letterSpacingMap.get(letterSpacing)!.add(identifier)
          }

          // Colors
          const color = computed.color
          if (color) {
            const rgb = color.match(/\d+/g)
            if (rgb) {
              const hex = '#' + rgb.map(x => parseInt(x).toString(16).padStart(2, '0')).join('')
              if (!colorMap.has(hex)) colorMap.set(hex, new Set())
              colorMap.get(hex)!.add(identifier)
            }
          }

          // Spacing (margin and padding on text elements)
          if (/p|h[1-6]|span|div|article|section/.test(tagName)) {
            ;['marginTop', 'marginBottom', 'paddingTop', 'paddingBottom'].forEach(prop => {
              const value = computed[prop as any]
              if (value && value !== '0px') {
                const key = `${prop}: ${value}`
                spacingMap.set(key, (spacingMap.get(key) || 0) + 1)
              }
            })
          }
        })

        // Process font stacks
        const fontStacksArray = Array.from(fontFamilies.entries()).map(([family, data]) => ({
          family,
          usage: data.usage,
          elements: Array.from(data.elements)
        }))

        // Process type scale and calculate ratio
        const sizesArray = Array.from(fontSizes.entries())
          .map(([size, elements]) => ({
            size,
            elements: Array.from(elements),
            pixels: parseFloat(size)
          }))
          .sort((a, b) => a.pixels - b.pixels)

        const typeScaleArray = sizesArray.map((item, i) => ({
          size: item.size,
          ratio: i > 0 ? item.pixels / sizesArray[i - 1].pixels : undefined,
          elements: item.elements
        }))

        // Detect scale ratio
        const ratios = typeScaleArray.filter(s => s.ratio).map(s => s.ratio!)
        const avgRatio = ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : 0

        // Process weights
        const weightMapArray = Array.from(fontWeights.entries())
          .map(([weight, elements]) => ({
            weight,
            elements: Array.from(elements)
          }))
          .sort((a, b) => parseInt(a.weight) - parseInt(b.weight))

        // Process line heights with ratios
        const lineHeightsArray = Array.from(lineHeightMap.entries()).map(([key, data]) => {
          const [lineHeight, fontSize] = key.split('@')
          const lhPx = parseFloat(lineHeight)
          const fsPx = parseFloat(fontSize)
          return {
            value: lineHeight,
            fontSize,
            ratio: lhPx / fsPx,
            elements: Array.from(data.elements)
          }
        })

        // Process letter spacing
        const letterSpacingArray = Array.from(letterSpacingMap.entries()).map(([value, elements]) => ({
          value,
          elements: Array.from(elements)
        }))

        // Process colors by frequency
        const colorsArray = Array.from(colorMap.entries())
          .map(([color, elements]) => ({
            color,
            count: elements.size,
            elements: Array.from(elements)
          }))
          .sort((a, b) => b.count - a.count)

        // Process spacing
        const spacingArray = Array.from(spacingMap.entries())
          .map(([key, count]) => {
            const [property, value] = key.split(': ')
            return { property, value, count }
          })
          .sort((a, b) => b.count - a.count)

        // Detect vertical rhythm
        const spacingValues = spacingArray.map(s => parseFloat(s.value))
        const gcdArray = (arr: number[]): number => {
          const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b)
          return arr.reduce((a, b) => gcd(a, b))
        }
        const baseUnit = spacingValues.length > 1 ? gcdArray(spacingValues.filter(v => v > 0)) : null
        const gridDetected = baseUnit !== null && baseUnit >= 4 && baseUnit <= 16

        setExtractedDNA({
          fontStacks: fontStacksArray,
          typeScale: typeScaleArray,
          weightMap: weightMapArray,
          lineHeights: lineHeightsArray,
          letterSpacing: letterSpacingArray,
          colors: colorsArray,
          spacing: spacingArray,
          verticalRhythm: { baseUnit, gridDetected },
          responsivePatterns
        })

      } catch (error) {
        console.error('Extraction error:', error)
        alert('Failed to extract DNA. Make sure the HTML is valid.')
      } finally {
        document.body.removeChild(iframe)
        setIsExtracting(false)
      }
    }
  }

  const exportAsCSS = () => {
    if (!extractedDNA) return

    const lines: string[] = [':root {']

    // Fonts
    extractedDNA.fontStacks.forEach((stack, i) => {
      const key = stack.usage === 'heading' ? 'heading' : stack.usage === 'monospace' ? 'mono' : 'body'
      lines.push(`  --font-${key}: ${stack.family};`)
    })

    // Type scale
    extractedDNA.typeScale.forEach((scale, i) => {
      lines.push(`  --text-${i}: ${scale.size};`)
    })

    // Weights
    extractedDNA.weightMap.forEach((w, i) => {
      lines.push(`  --weight-${i}: ${w.weight};`)
    })

    // Colors
    extractedDNA.colors.forEach((c, i) => {
      lines.push(`  --text-color-${i}: ${c.color};`)
    })

    // Spacing
    if (extractedDNA.verticalRhythm.baseUnit) {
      lines.push(`  --spacing-unit: ${extractedDNA.verticalRhythm.baseUnit}px;`)
    }

    lines.push('}')

    navigator.clipboard.writeText(lines.join('\n'))
    alert('CSS Custom Properties copied to clipboard!')
  }

  const exportAsJSON = () => {
    if (!extractedDNA) return

    const tokens = {
      fonts: Object.fromEntries(
        extractedDNA.fontStacks.map((s, i) => [s.usage, s.family])
      ),
      typeScale: extractedDNA.typeScale.map(s => s.size),
      weights: extractedDNA.weightMap.map(w => w.weight),
      lineHeights: extractedDNA.lineHeights.map(lh => ({
        value: lh.value,
        ratio: lh.ratio.toFixed(2)
      })),
      colors: extractedDNA.colors.map(c => c.color),
      spacing: extractedDNA.verticalRhythm.baseUnit ? {
        baseUnit: extractedDNA.verticalRhythm.baseUnit
      } : null
    }

    navigator.clipboard.writeText(JSON.stringify(tokens, null, 2))
    alert('Design Tokens (JSON) copied to clipboard!')
  }

  const exportAsTailwind = () => {
    if (!extractedDNA) return

    const config: string[] = [
      'module.exports = {',
      '  theme: {',
      '    extend: {',
      '      fontFamily: {'
    ]

    extractedDNA.fontStacks.forEach(stack => {
      const key = stack.usage === 'heading' ? 'heading' : stack.usage === 'monospace' ? 'mono' : 'sans'
      config.push(`        ${key}: [${stack.family}],`)
    })

    config.push('      },')
    config.push('      fontSize: {')

    extractedDNA.typeScale.forEach((scale, i) => {
      const lh = extractedDNA.lineHeights.find(l => l.fontSize === scale.size)
      if (lh) {
        config.push(`        '${i}': ['${scale.size}', { lineHeight: '${lh.ratio.toFixed(2)}' }],`)
      } else {
        config.push(`        '${i}': '${scale.size}',`)
      }
    })

    config.push('      },')
    config.push('      colors: {')
    config.push('        text: {')

    extractedDNA.colors.forEach((c, i) => {
      config.push(`          '${i}': '${c.color}',`)
    })

    config.push('        }')
    config.push('      }')
    config.push('    }')
    config.push('  }')
    config.push('}')

    navigator.clipboard.writeText(config.join('\n'))
    alert('Tailwind Config copied to clipboard!')
  }

  const getScaleRatioName = (ratio: number): string => {
    const ratios: { [key: string]: number } = {
      'Minor Second': 1.067,
      'Major Second': 1.125,
      'Minor Third': 1.2,
      'Major Third': 1.25,
      'Perfect Fourth': 1.333,
      'Augmented Fourth': 1.414,
      'Perfect Fifth': 1.5,
      'Golden Ratio': 1.618
    }

    let closest = 'Custom'
    let minDiff = Infinity

    Object.entries(ratios).forEach(([name, value]) => {
      const diff = Math.abs(value - ratio)
      if (diff < minDiff && diff < 0.05) {
        minDiff = diff
        closest = name
      }
    })

    return closest
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-200">
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
            09 -- TYPOGRAPHIC DNA
          </div>
          <h1 className="font-playfair text-5xl mb-4">Typographic DNA Extractor</h1>
          <p className="text-neutral-400 text-lg max-w-3xl">
            Reverse-engineer any website's typography system. Paste HTML and CSS to extract fonts, scales, spacing, and patterns into reusable design tokens.
          </p>
        </div>

        {/* Input Section */}
        <div className="mb-8 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-0 border border-neutral-800 w-fit">
            <button
              onClick={() => setInputMode('url')}
              className={`px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors border-r border-neutral-800 ${
                inputMode === 'url'
                  ? 'bg-[#B8963E]/10 text-[#B8963E]'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Website URL
            </button>
            <button
              onClick={() => setInputMode('html')}
              className={`px-4 py-2 font-mono text-xs uppercase tracking-wider transition-colors ${
                inputMode === 'html'
                  ? 'bg-[#B8963E]/10 text-[#B8963E]'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Paste HTML
            </button>
          </div>

          <div className="border border-neutral-800 bg-neutral-950/50 p-8">
            {inputMode === 'url' ? (
              <>
                <label className="block font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
                  Website Address
                </label>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && extractDNA()}
                  placeholder="apple.com"
                  className="w-full bg-black border border-neutral-800 text-neutral-200 p-4 font-mono text-sm focus:outline-none focus:border-[#B8963E] mb-4"
                />
              </>
            ) : (
              <>
                <label className="block font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
                  HTML + CSS Input
                </label>
                <p className="text-neutral-400 text-sm mb-4">
                  View source on any page, copy the HTML (including &lt;style&gt; tags or inline styles), and paste it here
                </p>
                <textarea
                  value={htmlInput}
                  onChange={(e) => setHtmlInput(e.target.value)}
                  placeholder="Paste your HTML here..."
                  className="w-full h-64 bg-black border border-neutral-800 text-neutral-200 p-4 font-mono text-sm resize-none focus:outline-none focus:border-[#B8963E] mb-4"
                />
              </>
            )}

            {fetchError && (
              <p className="text-red-400 text-sm font-mono mb-4">{fetchError}</p>
            )}

            <div className="flex gap-4">
              <button
                onClick={extractDNA}
                disabled={(inputMode === 'url' ? !urlInput.trim() : !htmlInput.trim()) || isExtracting}
                className="px-6 py-3 bg-[#B8963E] text-black font-mono text-xs uppercase tracking-[0.3em] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#d4ab4a] transition-colors"
              >
                {isExtracting ? 'Fetching & Extracting...' : 'Extract DNA'}
              </button>
              {inputMode === 'html' && (
                <button
                  onClick={loadSample}
                  className="px-6 py-3 border border-neutral-800 text-neutral-200 font-mono text-xs uppercase tracking-[0.3em] hover:border-[#B8963E] hover:text-[#B8963E] transition-colors"
                >
                  Load Sample
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        {extractedDNA && (
          <>
            {/* Export Buttons */}
            <div className="flex gap-4 mb-8">
              <button
                onClick={exportAsCSS}
                className="px-6 py-3 border border-neutral-800 text-neutral-200 font-mono text-xs uppercase tracking-[0.3em] hover:border-[#B8963E] hover:text-[#B8963E] transition-colors"
              >
                Copy as CSS Custom Properties
              </button>
              <button
                onClick={exportAsJSON}
                className="px-6 py-3 border border-neutral-800 text-neutral-200 font-mono text-xs uppercase tracking-[0.3em] hover:border-[#B8963E] hover:text-[#B8963E] transition-colors"
              >
                Copy as Design Tokens (JSON)
              </button>
              <button
                onClick={exportAsTailwind}
                className="px-6 py-3 border border-neutral-800 text-neutral-200 font-mono text-xs uppercase tracking-[0.3em] hover:border-[#B8963E] hover:text-[#B8963E] transition-colors"
              >
                Copy as Tailwind Config
              </button>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Font Stacks */}
              <div className="border border-neutral-800 bg-neutral-950/50 p-6">
                <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
                  01 -- Font Stack
                </h3>
                <div className="space-y-4">
                  {extractedDNA.fontStacks.map((stack, i) => (
                    <div key={i}>
                      <div className="text-sm text-neutral-400 mb-1">{stack.usage}</div>
                      <div className="font-mono text-sm break-all">{stack.family}</div>
                      <div className="text-xs text-neutral-600 mt-1">
                        Used in: {stack.elements.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-neutral-500 mt-4 italic">
                  {extractedDNA.fontStacks.length} unique font {extractedDNA.fontStacks.length === 1 ? 'stack' : 'stacks'} detected
                </p>
              </div>

              {/* Type Scale */}
              <div className="border border-neutral-800 bg-neutral-950/50 p-6">
                <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
                  02 -- Type Scale
                </h3>
                <div className="space-y-3">
                  {extractedDNA.typeScale.map((scale, i) => (
                    <div key={i} className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-3">
                        <div className="font-mono text-sm w-16">{scale.size}</div>
                        {scale.ratio && (
                          <div className="text-xs text-neutral-600">
                            ×{scale.ratio.toFixed(3)}
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-neutral-600">
                        {scale.elements.slice(0, 2).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
                {extractedDNA.typeScale.length > 1 && extractedDNA.typeScale[1].ratio && (
                  <p className="text-sm text-neutral-500 mt-4 italic">
                    Average scale ratio: {(extractedDNA.typeScale.reduce((sum, s) => sum + (s.ratio || 0), 0) / extractedDNA.typeScale.filter(s => s.ratio).length).toFixed(3)} — {getScaleRatioName(extractedDNA.typeScale[1].ratio)}
                  </p>
                )}
              </div>

              {/* Weight Map */}
              <div className="border border-neutral-800 bg-neutral-950/50 p-6">
                <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
                  03 -- Weight Map
                </h3>
                <div className="space-y-3">
                  {extractedDNA.weightMap.map((weight, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="font-mono text-sm">{weight.weight}</div>
                      <div className="text-xs text-neutral-600">
                        {weight.elements.slice(0, 3).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-neutral-500 mt-4 italic">
                  {extractedDNA.weightMap.length} weight {extractedDNA.weightMap.length === 1 ? 'value' : 'values'} in use
                </p>
              </div>

              {/* Line Heights */}
              <div className="border border-neutral-800 bg-neutral-950/50 p-6">
                <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
                  04 -- Line Heights
                </h3>
                <div className="space-y-3">
                  {extractedDNA.lineHeights.map((lh, i) => (
                    <div key={i}>
                      <div className="flex items-baseline justify-between">
                        <div className="font-mono text-sm">{lh.value}</div>
                        <div className="text-xs text-neutral-600">
                          @ {lh.fontSize}
                        </div>
                      </div>
                      <div className="text-xs text-neutral-500 mt-1">
                        Ratio: {lh.ratio.toFixed(2)} • {lh.elements.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-neutral-500 mt-4 italic">
                  {extractedDNA.lineHeights.length} unique line height {extractedDNA.lineHeights.length === 1 ? 'pairing' : 'pairings'}
                </p>
              </div>

              {/* Letter Spacing */}
              {extractedDNA.letterSpacing.length > 0 && (
                <div className="border border-neutral-800 bg-neutral-950/50 p-6">
                  <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
                    05 -- Letter Spacing
                  </h3>
                  <div className="space-y-3">
                    {extractedDNA.letterSpacing.map((ls, i) => (
                      <div key={i}>
                        <div className="font-mono text-sm">{ls.value}</div>
                        <div className="text-xs text-neutral-600 mt-1">
                          {ls.elements.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Color Palette */}
              <div className="border border-neutral-800 bg-neutral-950/50 p-6">
                <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
                  06 -- Color Palette
                </h3>
                <div className="space-y-3">
                  {extractedDNA.colors.map((color, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 border border-neutral-800"
                        style={{ backgroundColor: color.color }}
                      />
                      <div className="flex-1">
                        <div className="font-mono text-sm">{color.color}</div>
                        <div className="text-xs text-neutral-600">
                          Used {color.count}× • {color.elements.slice(0, 2).join(', ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-neutral-500 mt-4 italic">
                  {extractedDNA.colors.length} text {extractedDNA.colors.length === 1 ? 'color' : 'colors'} detected
                </p>
              </div>

              {/* Spacing System */}
              <div className="border border-neutral-800 bg-neutral-950/50 p-6">
                <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
                  07 -- Spacing System
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {extractedDNA.spacing.slice(0, 12).map((space, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="font-mono text-xs">{space.property}</div>
                      <div className="font-mono text-xs text-neutral-400">{space.value}</div>
                      <div className="text-xs text-neutral-600">×{space.count}</div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-neutral-500 mt-4 italic">
                  {extractedDNA.spacing.length} unique spacing {extractedDNA.spacing.length === 1 ? 'value' : 'values'}
                </p>
              </div>

              {/* Vertical Rhythm */}
              <div className="border border-neutral-800 bg-neutral-950/50 p-6">
                <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
                  08 -- Vertical Rhythm
                </h3>
                {extractedDNA.verticalRhythm.gridDetected ? (
                  <div>
                    <div className="text-4xl font-bold text-[#B8963E] mb-2">
                      {extractedDNA.verticalRhythm.baseUnit}px
                    </div>
                    <p className="text-sm text-neutral-400">
                      Baseline grid detected. All spacing values are multiples of {extractedDNA.verticalRhythm.baseUnit}px.
                    </p>
                    <div className="mt-4 h-32 border-l border-neutral-800 relative">
                      {[...Array(8)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute left-0 w-8 border-t border-neutral-800"
                          style={{ top: `${i * (extractedDNA.verticalRhythm.baseUnit! / 2)}px` }}
                        >
                          <span className="text-[10px] text-neutral-600 ml-10">
                            {i * (extractedDNA.verticalRhythm.baseUnit! / 2)}px
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-neutral-400">
                      No consistent baseline grid detected. Spacing values do not follow a regular pattern.
                    </p>
                    {extractedDNA.verticalRhythm.baseUnit && (
                      <p className="text-xs text-neutral-600 mt-2">
                        Common factor: {extractedDNA.verticalRhythm.baseUnit}px
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Responsive Patterns */}
              {extractedDNA.responsivePatterns.length > 0 && (
                <div className="border border-neutral-800 bg-neutral-950/50 p-6 lg:col-span-2">
                  <h3 className="font-mono text-xs uppercase tracking-[0.3em] text-[#B8963E] mb-4">
                    09 -- Responsive Patterns
                  </h3>
                  <div className="space-y-3">
                    {extractedDNA.responsivePatterns.map((pattern, i) => (
                      <div key={i}>
                        <div className="font-mono text-sm break-all">{pattern.pattern}</div>
                        <div className="text-xs text-neutral-600 mt-1">
                          Property: {pattern.property} • {pattern.elements.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-neutral-500 mt-4 italic">
                    Fluid typography using clamp() or min()/max() detected
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
