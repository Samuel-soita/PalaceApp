import { Router, Request, Response } from 'express';
import { upload } from '../../utils/upload.js';
import { authenticate } from '../../middleware/auth.middleware.js';

const router = Router();

router.post('/', authenticate, upload.single('file'), (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Return the public URL for the file
        const fileUrl = `/uploads/${req.file.filename}`;
        
        res.status(200).json({ 
            url: fileUrl,
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype 
        });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

export default router;
