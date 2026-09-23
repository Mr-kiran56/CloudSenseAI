import React from 'react';

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={key} className="font-semibold text-[var(--cs-ink)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={key}
          className="rounded-md bg-[#e8f0fe] px-1.5 py-0.5 font-mono text-[12px] text-[#174ea6]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

export const ChatMarkdown: React.FC<{ text: string; inverted?: boolean }> = ({ text, inverted }) => {
  const blocks = text.trim().split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < blocks.length) {
    const line = blocks[i];

    if (line.startsWith('|') && line.includes('|')) {
      const rows: string[] = [];
      while (i < blocks.length && blocks[i].startsWith('|')) {
        rows.push(blocks[i]);
        i += 1;
      }
      const parsed = rows
        .filter((r) => !/^\|\s*:?-{3,}/.test(r.replace(/\|/g, '|').trim()) && !r.includes('---'))
        .map((r) =>
          r
            .split('|')
            .map((c) => c.trim())
            .filter(Boolean)
        );
      if (parsed.length) {
        const [header, ...body] = parsed;
        nodes.push(
          <div key={`t-${i}`} className="my-3 overflow-x-auto rounded-xl border border-[var(--cs-line)]">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-[var(--cs-muted)]">
                <tr>
                  {header.map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri} className="border-t border-[var(--cs-line)]">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2">
                        {renderInline(cell, `td-${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < blocks.length && blocks[i].startsWith('- ')) {
        items.push(blocks[i].slice(2));
        i += 1;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1.5 pl-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7eb6ff]" />
              <span>{renderInline(item, `li-${ii}`)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < blocks.length && /^\d+\.\s/.test(blocks[i])) {
        items.push(blocks[i].replace(/^\d+\.\s/, ''));
        i += 1;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="my-2 space-y-2">
          {items.map((item, ii) => (
            <li key={ii} className="flex gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#e8f0fe] text-[11px] font-semibold text-[#1a73e8]">
                {ii + 1}
              </span>
              <span>{renderInline(item, `ol-${ii}`)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    nodes.push(
      <p key={`p-${i}`} className={`my-1.5 leading-relaxed ${inverted ? 'text-white' : ''}`}>
        {renderInline(line.replace(/^⚠️\s*/, ''), `p-${i}`)}
      </p>
    );
    i += 1;
  }

  return <div className="text-[14px]">{nodes}</div>;
};
