export interface FolderParseResult {
  folder?: string;
  content: string;
}

export function parseFolder(input: string): FolderParseResult {
  if (!input.includes('/')) {
    return { content: input.trim() };
  }

  // Regex to match "folder / content" format, accommodating optional spaces around the slash
  // Only match the first slash as the delimiter to handle paths or other slashes in the content.
  // Using [\s\S] instead of /s flag for wider environment compatibility (Next.js build)
  const structuralMatch = input.match(/^([^/]{1,30})\s*\/\s*([\s\S]*)$/);
  
  if (!structuralMatch) {
    return { content: input.trim() };
  }

  const header = structuralMatch[1].trim();
  const content = structuralMatch[2].trim();

  if (/^[a-zA-Z]:$|^\.$/.test(header) || header === '') {
    return { content: input.trim() };
  }

  return {
    folder: header,
    content: content
  };
}
