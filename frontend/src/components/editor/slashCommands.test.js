import { describe, expect, it } from 'vitest'
import { filterCommands } from './slashCommands'

const titles = (q, ctx) => filterCommands(q, ctx).map((c) => c.title)

describe('slash command filtering', () => {
  it('ranks a title match above a keyword match', () => {
    expect(titles('task', { erpnext: true })[0]).toBe('Task')
    expect(titles('task', { erpnext: true })).toContain('To-do list')
  })
  it('hides ERPNext commands when ERPNext is not installed', () => {
    expect(titles('task', {})).not.toContain('Task')
    expect(titles('', {})).not.toContain('Task')
  })
  it('hides /project on a project page', () => {
    expect(titles('project', { erpnext: true })).toContain('Project')
    expect(titles('project', { erpnext: true, projectPage: 'PROJ-0001' })).not.toContain('Project')
  })
  it('keeps the grouped menu when nothing is typed', () => {
    expect(filterCommands('', {})[0].group).toBe('Basic blocks')
  })
  it('matches headings by h-keyword', () => {
    expect(titles('h2')).toEqual(['Heading 2'])
  })
})
