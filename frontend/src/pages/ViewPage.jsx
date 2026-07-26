import React from 'react';
import { useParams } from 'react-router-dom';
import FileViewer from '../components/FileViewer';
import Seo from '../components/Seo';

function ViewPage() {
  const { filename } = useParams();
  return (
    <>
      <Seo
        title="Shared File"
        description="Preview a shared file in FileLinker."
        path={`/view/${filename || ''}`}
        noindex
      />
      <FileViewer filename={filename} />
    </>
  );
}

export default ViewPage;
