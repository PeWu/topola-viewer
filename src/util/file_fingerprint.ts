import md5 from 'md5';

/**
 * Returns a cache key for an uploaded file. Uses file metadata + a content
 * sample instead of md5-ing the full file (~500ms for 10MB).
 *
 * 4KB from each end captures the unique GEDCOM header (software, export date,
 * submitter) without the cost of hashing megabytes.
 */
export function fileFingerprint(
  file: Pick<File, 'name' | 'size' | 'lastModified'>,
  gedcom: string,
  imageFileNames: string,
): string {
  const sample = gedcom.slice(0, 4096) + gedcom.slice(-4096);
  return md5(
    `${file.name}|${file.size}|${file.lastModified}|${sample}|${imageFileNames}`,
  );
}
