export interface FolderParseResult {
  folder?: string;
  content: string;
}

export function parseFolder(input: string): FolderParseResult {
  if (!input.includes(' / ')) {
    return { content: input.trim() };
  }

  // Regex to match "folder / content" format, requiring spaces around the slash
  // to differentiate from dates (4/17) or CLI flags (/flushdns)
  const structuralMatch = input.match(/^([^/]{1,30})\s+\/\s+([\s\S]*)$/);
  
  if (!structuralMatch) {
    return { content: input.trim() };
  }

  const header = structuralMatch[1].trim();
  const content = structuralMatch[2].trim();

  // Additional check: if header is just a number and content starts with a number, 
  // it's likely a date (e.g., "4 / 17") - though with spaces it's less likely to be a date.
  // But let's be safe.
  if (/^\d{1,2}$/.test(header) && /^\d{1,2}/.test(content)) {
    return { content: input.trim() };
  }

  if (/^[a-zA-Z]:$|^\.$/.test(header) || header === '') {
    return { content: input.trim() };
  }

  return {
    folder: header,
    content: content
  };
}
