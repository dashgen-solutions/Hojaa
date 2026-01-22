"""
Service for analyzing uploaded documents and extracting text.
"""
import io
from typing import Optional, Tuple
import PyPDF2
import docx
from app.core.logger import get_logger

logger = get_logger(__name__)


class DocumentAnalyzer:
    """Service for analyzing and extracting text from documents."""
    
    @staticmethod
    def extract_text_from_pdf(file_content: bytes) -> str:
        """
        Extract text from PDF file.
        
        Args:
            file_content: PDF file content as bytes
        
        Returns:
            Extracted text
        """
        try:
            pdf_file = io.BytesIO(file_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            text_parts = []
            for page in pdf_reader.pages:
                text = page.extract_text()
                if text:
                    text_parts.append(text)
            
            extracted_text = "\n\n".join(text_parts)
            logger.info(f"Extracted {len(extracted_text)} characters from PDF")
            return extracted_text
            
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {str(e)}")
            raise ValueError(f"Failed to extract text from PDF: {str(e)}")
    
    @staticmethod
    def extract_text_from_docx(file_content: bytes) -> str:
        """
        Extract text from DOCX file.
        
        Args:
            file_content: DOCX file content as bytes
        
        Returns:
            Extracted text
        """
        try:
            doc_file = io.BytesIO(file_content)
            doc = docx.Document(doc_file)
            
            text_parts = []
            for paragraph in doc.paragraphs:
                if paragraph.text.strip():
                    text_parts.append(paragraph.text)
            
            extracted_text = "\n\n".join(text_parts)
            logger.info(f"Extracted {len(extracted_text)} characters from DOCX")
            return extracted_text
            
        except Exception as e:
            logger.error(f"Error extracting text from DOCX: {str(e)}")
            raise ValueError(f"Failed to extract text from DOCX: {str(e)}")
    
    @staticmethod
    def extract_text_from_txt(file_content: bytes) -> str:
        """
        Extract text from TXT file.
        
        Args:
            file_content: TXT file content as bytes
        
        Returns:
            Extracted text
        """
        try:
            text = file_content.decode('utf-8', errors='ignore')
            logger.info(f"Extracted {len(text)} characters from TXT")
            return text
            
        except Exception as e:
            logger.error(f"Error extracting text from TXT: {str(e)}")
            raise ValueError(f"Failed to extract text from TXT: {str(e)}")
    
    @classmethod
    def analyze_document(
        cls,
        file_content: bytes,
        filename: str
    ) -> Tuple[str, str]:
        """
        Analyze document and extract text based on file type.
        
        Args:
            file_content: File content as bytes
            filename: Original filename
        
        Returns:
            Tuple of (extracted_text, document_type)
        """
        filename_lower = filename.lower()
        
        try:
            if filename_lower.endswith('.pdf'):
                text = cls.extract_text_from_pdf(file_content)
                doc_type = "pdf"
            elif filename_lower.endswith('.docx'):
                text = cls.extract_text_from_docx(file_content)
                doc_type = "docx"
            elif filename_lower.endswith('.doc'):
                # Basic handling for .doc (older Word format)
                # For production, consider using python-docx2txt or similar
                text = file_content.decode('utf-8', errors='ignore')
                doc_type = "doc"
            elif filename_lower.endswith('.txt'):
                text = cls.extract_text_from_txt(file_content)
                doc_type = "txt"
            else:
                raise ValueError(f"Unsupported file type: {filename}")
            
            if not text or len(text.strip()) < 10:
                raise ValueError("Document appears to be empty or too short")
            
            logger.info(f"Successfully analyzed {doc_type} document: {filename}")
            return text.strip(), doc_type
            
        except Exception as e:
            logger.error(f"Error analyzing document {filename}: {str(e)}")
            raise


# Global document analyzer instance
document_analyzer = DocumentAnalyzer()
