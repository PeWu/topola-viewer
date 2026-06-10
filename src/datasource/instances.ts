import {EmbeddedDataSource} from './embedded';
import {GoogleDriveDataSource} from './google_drive';
import {GedcomUrlDataSource, UploadedDataSource} from './load_data';

export const uploadedDataSource = new UploadedDataSource();
export const gedcomUrlDataSource = new GedcomUrlDataSource();
export const embeddedDataSource = new EmbeddedDataSource();
export const googleDriveDataSource = new GoogleDriveDataSource();
