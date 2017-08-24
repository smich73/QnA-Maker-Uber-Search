import os
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.pdfdevice import TagExtractor
from pdfminer.converter import XMLConverter, HTMLConverter, TextConverter
from pdfminer.layout import LAParams
from pdfminer.pdfpage import PDFPage

def extract_text(filename):
    try:
        print ("Extracting {}".format(filename))
        output_filename = ("{}.txt".format(filename))

        if os.path.exists(output_filename):
            return

        fp = open(filename, 'rb')
        output = open(output_filename, 'w')
        rsrcmgr = PDFResourceManager()
        laparams = LAParams()
        device = TextConverter(rsrcmgr, output, laparams=laparams)
        interpreter = PDFPageInterpreter(rsrcmgr, device)
        for page in PDFPage.get_pages(fp):
            # page.rotate = (page.rotate + rotation) % 360
            interpreter.process_page(page)
        fp.close()
        device.close()
    
    except FileNotFoundError as inst:
        text_file = filename.split('/')
        print("Error: File not found:", text_file[-1])

    except Exception as inst:
        print(inst)
