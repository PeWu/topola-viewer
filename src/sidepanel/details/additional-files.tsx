import {List} from 'semantic-ui-react';

export interface FileEntry {
  url: string;
  filename?: string;
  titl?: string;
}

interface Props {
  files?: FileEntry[];
}

export function AdditionalFiles({files}: Props) {
  if (!files?.length) return null;

  return (
    <List>
      {files.map((file, index) => (
        <List.Item key={index}>
          <List.Icon verticalAlign="middle" name="circle" size="tiny" />
          <List.Content>
            <List.Header>
              <a target="_blank" href={file.url} rel="noopener noreferrer">
                {file.filename || file.url.split('/').pop() || file.url}
              </a>
            </List.Header>
            <List.Description>
              {file.titl && <div>{file.titl}</div>} 
            </List.Description>
          </List.Content>
        </List.Item>
      ))}
    </List>
  );
}
