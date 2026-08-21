// RevealOnScroll.jsx
import React from"react";
import { useInView } from"react-intersection-observer";
import { motion } from"framer-motion";
import PrivateRoute from"../Safety/ProtectedRoute";

export default function RevealOnScroll({ children, className ="" }) {
 const [ref, inView] = useInView({
 triggerOnce: true, // bir marta ko'rsatish uchun
 threshold: 0.15, // 15% ko'rinsa ishga tushadi
 rootMargin:"0px 0px -10% 0px",
 });

 return (
 <motion.div
 ref={ref}
 className={className}
 initial={{ opacity: 0, y: 18 }}
 animate={inView ? { opacity: 1, y: 0 } : {}} 
 transition={{ duration: 0.6, ease:"easeOut" }}
 >
 
 {children}
 
 </motion.div>
 );
}
