import os
import sys
import docx
from docx.shared import Cm, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def create_ticket_doc(paper_type="A4"):
    doc = docx.Document()
    section = doc.sections[0]

    if paper_type == "A4":
        section.page_width = Cm(21.0)
        section.page_height = Cm(29.7)
        section.top_margin = Cm(1.0)
        section.bottom_margin = Cm(1.0)
        section.left_margin = Cm(1.0)
        section.right_margin = Cm(1.0)
    else: # F4 / Folio
        section.page_width = Cm(21.5)
        section.page_height = Cm(33.0)
        section.top_margin = Cm(1.5)
        section.bottom_margin = Cm(1.5)
        section.left_margin = Cm(1.25)
        section.right_margin = Cm(1.25)

    section.header_distance = Cm(0)
    section.footer_distance = Cm(0)

    # Hapus paragraf default pertama
    if len(doc.paragraphs) > 0:
        p_init = doc.paragraphs[0]._element
        p_init.getparent().remove(p_init)

    logo_path = 'img/header_logos.png'

    def setup_table_properties(table):
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = False
        tblPr = table._tbl.tblPr
        tblLayout = parse_xml(f'<w:tblLayout {nsdecls("w")} w:type="fixed"/>')
        tblPr.append(tblLayout)

        tblCellMar = parse_xml(f'''
            <w:tblCellMar {nsdecls("w")}>
                <w:top w:w="0" w:type="dxa"/>
                <w:bottom w:w="0" w:type="dxa"/>
                <w:left w:w="20" w:type="dxa"/>
                <w:right w:w="20" w:type="dxa"/>
            </w:tblCellMar>
        ''')
        tblPr.append(tblCellMar)

        tblBorders = parse_xml(f'''
            <w:tblBorders {nsdecls("w")}>
                <w:top w:val="dashed" w:sz="4" w:space="0" w:color="B0B0B0"/>
                <w:left w:val="dashed" w:sz="4" w:space="0" w:color="B0B0B0"/>
                <w:bottom w:val="dashed" w:sz="4" w:space="0" w:color="B0B0B0"/>
                <w:right w:val="dashed" w:sz="4" w:space="0" w:color="B0B0B0"/>
                <w:insideH w:val="dashed" w:sz="4" w:space="0" w:color="B0B0B0"/>
                <w:insideV w:val="dashed" w:sz="4" w:space="0" w:color="B0B0B0"/>
            </w:tblBorders>
        ''')
        tblPr.append(tblBorders)

    def populate_tickets(table, team_name, prefix, start_num, total_tickets, num_color_rgb, num_font_size=28):
        num = start_num
        for r_idx, row in enumerate(table.rows):
            trPr = row._tr.get_or_add_trPr()
            trHeight = parse_xml(f'<w:trHeight {nsdecls("w")} w:val="3100" w:hRule="exact"/>')
            cantSplit = parse_xml(f'<w:cantSplit {nsdecls("w")}/>')
            trPr.append(trHeight)
            trPr.append(cantSplit)

            for c_idx, cell in enumerate(row.cells):
                if num > start_num + total_tickets - 1:
                    break

                cell.width = Cm(4.75)
                cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER

                # Elemen 1: Logo Perusahaan (SIG, Tonasa, STMC, HUT 58)
                p_logo = cell.paragraphs[0]
                p_logo.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p_logo.paragraph_format.space_before = Pt(0)
                p_logo.paragraph_format.space_after = Pt(2)
                p_logo.paragraph_format.line_spacing = Pt(12)
                run_logo = p_logo.add_run()
                run_logo.add_picture(logo_path, width=Cm(3.6))

                # Elemen 2: HUT KE-58 SEMEN TONASA (Font 7pt, Bold, Biru Tua)
                p2 = cell.add_paragraph()
                p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p2.paragraph_format.space_before = Pt(0)
                p2.paragraph_format.space_after = Pt(1)
                p2.paragraph_format.line_spacing = Pt(8.5)
                r2 = p2.add_run("HUT KE-58 SEMEN TONASA")
                r2.font.name = "Arial"
                r2.font.size = Pt(7)
                r2.font.bold = True
                r2.font.color.rgb = RGBColor(11, 60, 97)

                # Elemen 3: [NAMA TIM MEDIS] (Font 7.5pt, Bold)
                p3 = cell.add_paragraph()
                p3.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p3.paragraph_format.space_before = Pt(0)
                p3.paragraph_format.space_after = Pt(2)
                p3.paragraph_format.line_spacing = Pt(9.5)
                r3 = p3.add_run(team_name)
                r3.font.name = "Arial"
                r3.font.size = Pt(7.5) if len(team_name) > 20 else Pt(8.5)
                r3.font.bold = True
                r3.font.color.rgb = RGBColor(33, 37, 41)

                # Elemen 4: NOMOR ANTRIAN (Font 6pt)
                p4 = cell.add_paragraph()
                p4.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p4.paragraph_format.space_before = Pt(0)
                p4.paragraph_format.space_after = Pt(0)
                p4.paragraph_format.line_spacing = Pt(7)
                r4 = p4.add_run("NOMOR ANTRIAN")
                r4.font.name = "Arial"
                r4.font.size = Pt(6)
                r4.font.color.rgb = RGBColor(108, 117, 125)

                # Elemen 5: [KODE ANTREAN] (Font Bold, Sesuai Tim)
                p5 = cell.add_paragraph()
                p5.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p5.paragraph_format.space_before = Pt(0)
                p5.paragraph_format.space_after = Pt(2)
                p5.paragraph_format.line_spacing = Pt(num_font_size)
                r5 = p5.add_run(f"{prefix}-{num:03d}")
                r5.font.name = "Arial Black"
                r5.font.size = Pt(num_font_size)
                r5.font.bold = True
                r5.font.color.rgb = num_color_rgb

                # Elemen 6: Silakan tunggu nomor Anda dipanggil (Font 6.5pt, Italic)
                p6 = cell.add_paragraph()
                p6.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p6.paragraph_format.space_before = Pt(0)
                p6.paragraph_format.space_after = Pt(1)
                p6.paragraph_format.line_spacing = Pt(7.5)
                r6 = p6.add_run("Silakan tunggu nomor Anda dipanggil")
                r6.font.name = "Arial"
                r6.font.size = Pt(6.5)
                r6.font.italic = True
                r6.font.color.rgb = RGBColor(108, 117, 125)

                # Elemen 7: Terima kasih pahlawan donor! (Font 6.5pt, Bold)
                p7 = cell.add_paragraph()
                p7.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p7.paragraph_format.space_before = Pt(0)
                p7.paragraph_format.space_after = Pt(0)
                p7.paragraph_format.line_spacing = Pt(7.5)
                r7 = p7.add_run("Terima kasih pahlawan donor!")
                r7.font.name = "Arial"
                r7.font.size = Pt(6.5)
                r7.font.bold = True
                r7.font.color.rgb = RGBColor(33, 37, 41)

                num += 1

    def add_page_break():
        p_break = doc.add_paragraph()
        p_break.paragraph_format.space_before = Pt(0)
        p_break.paragraph_format.space_after = Pt(0)
        p_break.paragraph_format.line_spacing = Pt(1)
        r_brk = p_break.add_run()
        r_brk.font.size = Pt(1)
        r_brk.add_break(WD_BREAK.PAGE)

    # 1. Tim 1: UTD PANGKEP & STMC (P-001 s/d P-200) -> 50 baris = 10 halaman
    print(f"[{paper_type}] Tim 1: UTD PANGKEP & STMC (P-001 s/d P-200, Oranye)...")
    tbl_p = doc.add_table(rows=50, cols=4)
    setup_table_properties(tbl_p)
    populate_tickets(tbl_p, "UTD PANGKEP & STMC", "P", 1, 200, RGBColor(230, 81, 0), num_font_size=34)

    # Page Break 1
    add_page_break()

    # 2. Tim 2A: PMI MAKASSAR (MANUAL) & STMC (MM-001 s/d MM-400) -> 100 baris = 20 halaman
    print(f"[{paper_type}] Tim 2A: PMI MAKASSAR (MANUAL) & STMC (MM-001 s/d MM-400, Biru)...")
    tbl_mm = doc.add_table(rows=100, cols=4)
    setup_table_properties(tbl_mm)
    populate_tickets(tbl_mm, "PMI MAKASSAR (MANUAL) & STMC", "MM", 1, 400, RGBColor(25, 118, 210), num_font_size=28)

    # Page Break 2
    add_page_break()

    # 3. Tim 2B: PMI MAKASSAR (ONLINE) & STMC (MO-001 s/d MO-400) -> 100 baris = 20 halaman
    print(f"[{paper_type}] Tim 2B: PMI MAKASSAR (ONLINE) & STMC (MO-001 s/d MO-400, Merah)...")
    tbl_mo = doc.add_table(rows=100, cols=4)
    setup_table_properties(tbl_mo)
    populate_tickets(tbl_mo, "PMI MAKASSAR (ONLINE) & STMC", "MO", 1, 400, RGBColor(211, 47, 47), num_font_size=28)

    # Trailing paragraph
    p_trail = doc.add_paragraph()
    p_trail.paragraph_format.space_before = Pt(0)
    p_trail.paragraph_format.space_after = Pt(0)
    p_trail.paragraph_format.line_spacing = Pt(1)
    r_trail = p_trail.add_run()
    r_trail.font.size = Pt(1)

    filename = "Karcis_Antrian_Donor_Darah_STMC.docx" if paper_type == "A4" else "Karcis_Antrian_Donor_Darah_STMC_F4.docx"
    doc.save(filename)
    print(f"[{paper_type}] Sukses menyimpan: {filename}")

if __name__ == '__main__':
    create_ticket_doc("A4")
    create_ticket_doc("F4")
    print("ALL DOCUMENTS GENERATED!")
