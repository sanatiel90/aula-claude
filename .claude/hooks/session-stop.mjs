import fs from 'node:fs'

const FILE_EDITING_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

/**
 * Lê o transcript (JSONL) e verifica se, desde a última mensagem do usuário,
 * alguma ferramenta de edição de arquivos foi usada.
 * Em caso de erro de leitura, retorna false para nunca bloquear a sessão.
 */
function hasFileChangesInCurrentTurn(transcriptPath) {
  try {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return false

    const entries = fs
      .readFileSync(transcriptPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line)
        } catch {
          return null
        }
      })
      .filter(Boolean)

    for (let index = entries.length - 1; index >= 0; index--) {
      const entry = entries[index]
      const content = entry.message?.content

      if (entry.type === 'user') {
        const isToolResult =
          Array.isArray(content) && content.some((block) => block.type === 'tool_result')
        // Chegou ao prompt do usuário que iniciou o turno atual: para a busca
        if (!isToolResult && !entry.isMeta) return false
        continue
      }

      if (entry.type === 'assistant' && Array.isArray(content)) {
        const hasEdit = content.some(
          (block) => block.type === 'tool_use' && FILE_EDITING_TOOLS.has(block.name)
        )
        if (hasEdit) return true
      }
    }

    return false
  } catch {
    return false
  }
}

let input
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}')
} catch {
  process.exit(0)
}

if (input.stop_hook_active) process.exit(0)

if (hasFileChangesInCurrentTurn(input.transcript_path)) {
  console.log(
    JSON.stringify({
      decision: 'block',
      reason: 'Revise o que foi feito e confirme se tudo está correto antes de finalizar.',
    })
  )
}

process.exit(0)
