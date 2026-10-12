import { CAD_COMMANDS, COMMAND_GROUPS } from '../kade/commands'

/** ❓ Commands: every cad command with what it does and a tiny example, plus the ⚙️ Gear to start from. */
export function CommandsReference({ onUseGear }: { onUseGear(): void }) {
  return (
    <section className="panel commands" aria-label="Commands">
      <p className="hint">Every command makes a new part. Parts never change by themselves.</p>
      {COMMAND_GROUPS.map(({ group, title }) => (
        <div key={group}>
          <h3>{title}</h3>
          <dl className="command-list">
            {CAD_COMMANDS.filter((c) => c.group === group).map((c) => (
              <div key={`${c.on}.${c.name}`} className="command">
                <dt><code>{c.call}</code></dt>
                <dd>{c.does} <code className="command-example">{c.example}</code></dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      <div className="gear-card">
        <h3>⚙️ Gear</h3>
        <p className="hint">A finished shape made only from these commands. It has settings for teeth, size, thickness and hole.</p>
        <button type="button" className="tool-button" data-testid="use-gear" onClick={onUseGear}>Use as a starting point</button>
      </div>
    </section>
  )
}
