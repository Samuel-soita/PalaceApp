import React, { useState, useEffect } from 'react';
import { Box, Typography, Container, keyframes } from '@mui/material';
import { Quote } from 'lucide-react';

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); filter: blur(10px); }
  to { opacity: 1; transform: scale(1); filter: blur(0px); }
`;

const fadeOut = keyframes`
  from { opacity: 1; transform: scale(1); }
  to { opacity: 0; transform: scale(1.05); filter: blur(20px); }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

export const WelcomeSplash = ({ onComplete }: { onComplete: () => void }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsExiting(true), 4000);
        const removeTimer = setTimeout(onComplete, 4800);
        return () => {
            clearTimeout(timer);
            clearTimeout(removeTimer);
        };
    }, [onComplete]);

    return (
        <Box
            sx={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(5, 5, 20, 0.95)',
                backdropFilter: 'blur(15px)',
                animation: `${isExiting ? fadeOut : fadeIn} 0.8s ease-in-out forwards`,
                padding: { xs: 2, md: 4 }
            }}
        >
            <Box
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    overflow: 'hidden',
                    pointerEvents: 'none',
                    opacity: 0.3
                }}
            >
                <Box
                    sx={{
                        position: 'absolute',
                        top: '-50%',
                        left: '-50%',
                        width: '200%',
                        height: '200%',
                        background: 'radial-gradient(circle at center, var(--cyan) 0%, transparent 60%)',
                        filter: 'blur(100px)',
                        animation: `${shimmer} 15s linear infinite`
                    }}
                />
            </Box>

            <Container maxWidth="md" sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
                <Typography
                    variant="h6"
                    sx={{
                        color: 'var(--cyan)',
                        letterSpacing: 8,
                        fontWeight: 900,
                        mb: 2,
                        opacity: 0.8,
                        textTransform: 'uppercase',
                        fontSize: { xs: '0.75rem', md: '1rem' }
                    }}
                >
                    WELCOME TO
                </Typography>

                <Typography
                    variant="h2"
                    sx={{
                        fontWeight: 950,
                        color: '#fff',
                        letterSpacing: -2,
                        lineHeight: 1,
                        mb: 1,
                        fontSize: { xs: '2.5rem', md: '4.5rem' },
                        textShadow: '0 0 30px rgba(0, 255, 255, 0.3)'
                    }}
                >
                    PRAYER PALACE
                </Typography>
                
                <Typography
                    variant="h4"
                    sx={{
                        fontWeight: 800,
                        color: 'rgba(255,255,255,0.7)',
                        mb: 6,
                        letterSpacing: 2,
                        fontSize: { xs: '1.2rem', md: '2rem' }
                    }}
                >
                    APOSTOLIC MINISTRY
                </Typography>

                <Box sx={{ mb: 8 }}>
                    <Typography
                        variant="h6"
                        sx={{
                            color: 'transparent',
                            background: 'linear-gradient(90deg, #fff, var(--cyan), #fff)',
                            backgroundSize: '200% auto',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            fontWeight: 950,
                            letterSpacing: 2,
                            animation: `${shimmer} 3s linear infinite`,
                            display: 'inline-block'
                        }}
                    >
                        DEPOPULATE HELL • POPULATE HEAVEN
                    </Typography>
                </Box>

                <Box
                    sx={{
                        p: 4,
                        bgcolor: 'rgba(255,255,255,0.03)',
                        borderRadius: 4,
                        border: '1px solid rgba(255,255,255,0.1)',
                        position: 'relative'
                    }}
                >
                    <Quote 
                        size={40} 
                        color="var(--cyan)" 
                        style={{ position: 'absolute', top: -20, left: 20, opacity: 0.5 }} 
                    />
                    
                    <Typography
                        variant="h5"
                        sx={{
                            fontWeight: 900,
                            color: 'var(--cyan)',
                            mb: 2,
                            letterSpacing: 1,
                            fontSize: { xs: '1rem', md: '1.5rem' }
                        }}
                    >
                        OBADIAH 1:17
                    </Typography>

                    <Typography
                        variant="body1"
                        sx={{
                            color: 'rgba(255,255,255,0.9)',
                            fontStyle: 'italic',
                            fontWeight: 500,
                            lineHeight: 1.6,
                            fontSize: { xs: '1rem', md: '1.25rem' }
                        }}
                    >
                        "BUT UPON MOUNT ZION THERE SHALL BE DELIVERANCE AND HOLINESS, AND THE CHILDREN OF JACOB SHALL POSSESS THEIR POSSESSIONS"
                    </Typography>
                </Box>
            </Container>
        </Box>
    );
};
