"""Extract text from a PDF document"""

import os
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.pdfdevice import TagExtractor
from pdfminer.converter import XMLConverter, HTMLConverter, TextConverter
from pdfminer.layout import LAParams
from pdfminer.pdfpage import PDFPage

def extract_text(filename):
    """Extract text from the specified document"""

    try:
        print("Extracting {}".format(filename))
        output_filename = ("{}.txt".format(filename))

        if os.path.exists(output_filename):
            return

        filepath = open(filename, 'rb')
        output = open(output_filename, 'w')
        rsrcmgr = PDFResourceManager()
        laparams = LAParams()
        device = TextConverter(rsrcmgr, output, laparams=laparams)
        interpreter = PDFPageInterpreter(rsrcmgr, device)
        for page in PDFPage.get_pages(filepath):
            # page.rotate = (page.rotate + rotation) % 360
            interpreter.process_page(page)
        filepath.close()
        device.close()

    except FileNotFoundError:
        text_file = filename.split('/')
        print("Error: File not found:", text_file[-1])
