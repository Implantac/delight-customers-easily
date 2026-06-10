import React, { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text, Float, Environment, Center } from "@react-three/drei";
import * as THREE from "three";

/**
 * Motor de Renderização 3D - USE PATRIUM Premium
 * Implementação de logo sólida e texto com efeito de profundidade.
 */

interface SceneProps {
  rotationSpeed?: number;
}

const Logo3D = ({ rotationSpeed = 1.2 }: SceneProps) => {
  const groupRef = useRef<THREE.Group>(null);
  
  // Cores institucionais (Baseadas na logo enviada)
  const primaryColor = "#0EA5E9"; // Sky 500
  const secondaryColor = "#0284C7"; // Sky 600
  
  useFrame((state) => {
    if (groupRef.current) {
      // Rotação suave no eixo Y
      groupRef.current.rotation.y += 0.01 * rotationSpeed;
      // Pequena oscilação para profundidade dinâmica
      groupRef.current.rotation.x = Math.sin(state.clock.getElapsedTime() * 0.5) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      <Center top>
        {/* Representação Sólida da Logo (Prisma Tecnológico) */}
        <mesh position={[0, 1.2, 0]} castShadow>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial 
            color={primaryColor} 
            metalness={0.8} 
            roughness={0.2} 
            emissive={primaryColor}
            emissiveIntensity={0.2}
          />
        </mesh>
        
        {/* Anel de Energia (Aura Tecnológica) */}
        <mesh position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.5, 0.02, 16, 100]} />
          <meshBasicMaterial color={primaryColor} transparent opacity={0.3} />
        </mesh>

        {/* Texto USE PATRIUM em 3D */}
        <Float
          speed={2} 
          rotationIntensity={0.5} 
          floatIntensity={0.5}
        >
          <group position={[0, -0.2, 0]}>
            <Text
              font="https://fonts.gstatic.com/s/inter/v12/UcCOjFws63Fel03dPV1icpZ7S2cA.woff"
              fontSize={1.2}
              color={primaryColor}
              anchorX="center"
              anchorY="middle"
              maxWidth={10}
              lineHeight={1}
              letterSpacing={0.2}
              textAlign="center"
              position={[0, 0.4, 0]}
            >
              USE
              <meshStandardMaterial 
                color={primaryColor} 
                metalness={1} 
                roughness={0} 
                emissive={primaryColor}
                emissiveIntensity={0.5}
              />
            </Text>
            <Text
              font="https://fonts.gstatic.com/s/inter/v12/UcCOjFws63Fel03dPV1icpZ7S2cA.woff"
              fontSize={1.4}
              color={primaryColor}
              anchorX="center"
              anchorY="middle"
              maxWidth={10}
              lineHeight={1}
              letterSpacing={0.4}
              textAlign="center"
              position={[0, -0.6, 0]}
            >
              PATRIUM
              <meshStandardMaterial 
                color={primaryColor} 
                metalness={1} 
                roughness={0} 
                emissive={primaryColor}
                emissiveIntensity={0.5}
              />
            </Text>
          </group>
        </Float>
        
        {/* Subtexto Estratégico */}
        <Text
          fontSize={0.2}
          color="#94a3b8"
          position={[0, -1.2, 0]}
          maxWidth={10}
          textAlign="center"
          letterSpacing={0.3}
        >
          SALES INTELLIGENCE
        </Text>
      </Center>
    </group>
  );
};

export const ThreeDLogo = ({ className = "h-[400px] w-full", rotationSpeed = 1.2 }: { className?: string, rotationSpeed?: number }) => {
  return (
    <div className={className}>
      <Canvas
        shadows
        camera={{ position: [0, 0, 6], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1.5} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />
        
        <React.Suspense fallback={null}>
          <Logo3D rotationSpeed={rotationSpeed} />
          <Environment preset="city" />
        </React.Suspense>
      </Canvas>
    </div>
  );
};
