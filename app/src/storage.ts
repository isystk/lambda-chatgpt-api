import { Request } from 'express'
import multer from 'multer'
import fs from 'fs'

const local = multer.diskStorage({
  destination: function (
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) {
    const dir = '/tmp'
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir)
    }
    cb(null, dir)
  },
  filename: function (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) {
    const ext = file.originalname.split('.').pop() // ファイルの拡張子取得
    cb(null, file.fieldname + '-' + Date.now() + '.' + ext) // 拡張子をファイル名に含める
  },
})

export const storage = () => {
  return multer({ storage: local })
}
