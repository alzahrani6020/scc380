'use client';

import { useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FileDown } from 'lucide-react';
import Button from './ui/Button';

interface PdfExporterProps {
  children: React.ReactNode;
  filename?: string;
  buttonLabel?: string;
  buttonVariant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

export default function PdfExporter({
  children,
  filename = 'document.pdf',
  buttonLabel = 'تصدير PDF',
  buttonVariant = 'ghost',
}: PdfExporterProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    if (!printRef.current) return;

    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(filename);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('فشل تصدير PDF');
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button variant={buttonVariant} onClick={handleExport}>
          <FileDown className="h-4 w-4" />
          {buttonLabel}
        </Button>
      </div>
      <div ref={printRef} className="bg-white text-slate-900 p-8 rounded-xl">
        {children}
      </div>
    </div>
  );
}
